// Cliente do Mercado Livre — SOMENTE SERVIDOR.
//
// Porte fiel do adaptador Python da Zion (zion/marketplaces/mercadolivre.py):
// OAuth refresh, previsão de categoria e criação de item (/items).
//
// NUNCA importe este módulo em componentes do cliente: ele usa o segredo do
// app ML (ML_CLIENT_SECRET), que vive só no .env do servidor. É consumido
// apenas pela rota /api/ml/publicar.

const API = "https://api.mercadolibre.com";
const TOKEN_URL = `${API}/oauth/token`;

export interface TokensML {
  accessToken: string;
  refreshToken: string;
  userId?: string;
}

/**
 * Destila o VEREDITO do Mercado Livre em uma mensagem específica (PR-006).
 * O ML espalha o detalhe em DOIS formatos: `cause[]` (clássico) e `errors[]`
 * (com `message` e `cause[]` aninhados) — ler só um deles produzia erros
 * genéricos ("Chart validation errors found") e o feedback real do ambiente
 * era perdido. Exportada: é a tradutora de fronteira do veredito externo
 * (proto-Knowledge-Source — ver SEEDS S-13) e testável puramente.
 */
export async function extrairErro(resposta: Response): Promise<string> {
  try {
    const j = (await resposta.json()) as {
      message?: string;
      error?: string;
      cause?: { message?: string }[];
      errors?: { message?: string; cause?: { message?: string }[] }[];
    };
    const causas = (j.cause ?? []).map((c) => c.message);
    const detalhados = (j.errors ?? []).flatMap((e) => [
      e.message,
      ...(e.cause ?? []).map((c) => c.message),
    ]);
    const detalhe = [...causas, ...detalhados].filter(Boolean).join("; ");
    return [j.message || j.error, detalhe].filter(Boolean).join(" — ") || `HTTP ${resposta.status}`;
  } catch {
    return `HTTP ${resposta.status}`;
  }
}

/**
 * Normaliza o nome da guia SÓ para comparação (idempotência). Não altera o nome
 * usado na criação — aplica trim + colapso de espaços internos dos dois lados
 * (nome desejado e names["MLB"] retornado pela API), tornando o match estável a
 * despeito de espaços duplicados/finais (ex.: "Sandália ... Modare ").
 */
function normalizarNomeGuia(s: string | undefined | null): string {
  return (s ?? "").trim().replace(/\s+/g, " ");
}

/**
 * Extrai mensagem de erro de um corpo JÁ lido como texto (quando a Response não
 * pode ser reconsumida). Lê message/error/cause[]/errors[] — inclusive o
 * `errors[]` que a API de charts usa (ex.: filters_validation_error).
 */
function mensagemErroTexto(texto: string, status: number): string {
  try {
    const j = JSON.parse(texto) as {
      message?: string;
      error?: string;
      cause?: { message?: string }[];
      errors?: { message?: string }[];
    };
    const partes = [
      j.message || j.error,
      ...(j.cause ?? []).map((c) => c.message),
      ...(j.errors ?? []).map((e) => e.message),
    ].filter(Boolean);
    return partes.join(" — ") || `HTTP ${status}`;
  } catch {
    return `HTTP ${status}`;
  }
}

/** Troca o `code` do OAuth (authorization_code) pelo primeiro par de tokens. */
export async function trocarCodigoPorToken(cred: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<TokensML> {
  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      code: cred.code,
      redirect_uri: cred.redirectUri,
    }),
  });
  if (!resposta.ok) throw new Error(`Falha ao conectar com o ML: ${await extrairErro(resposta)}`);
  const j = (await resposta.json()) as {
    access_token: string;
    refresh_token: string;
    user_id?: number;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    userId: j.user_id != null ? String(j.user_id) : undefined,
  };
}

/**
 * O ML RESPONDEU recusando a renovação — `status` é o HTTP da resposta dele.
 *
 * Existe para que o chamador possa separar "a credencial salva não vale mais"
 * (4xx: só reconectar resolve) de "o ML está fora do ar" (5xx: tentar depois)
 * sem inspecionar a prosa em inglês da mensagem. Uma falha de REDE não produz
 * este erro: nesse caso o `fetch` rejeita antes, e o chamador continua vendo o
 * erro genérico — corretamente, porque ninguém sabe o estado da credencial.
 *
 * A mensagem é idêntica à de antes: quem só faz `catch (e) { e.message }` não
 * muda de comportamento.
 */
export class RenovacaoRecusadaError extends Error {
  readonly status: number;
  constructor(status: number, detalhe: string) {
    super(`Falha ao renovar token do ML: ${detalhe}`);
    this.name = "RenovacaoRecusadaError";
    this.status = status;
  }
  /** true quando o ML atribuiu o problema à credencial, e não a si mesmo. */
  get credencialRecusada(): boolean {
    return this.status >= 400 && this.status < 500;
  }
}

/** Renova o access token via refresh_token grant. Retorna o novo par de tokens. */
export async function renovarToken(cred: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokensML> {
  const resposta = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: cred.clientId,
      client_secret: cred.clientSecret,
      refresh_token: cred.refreshToken,
    }),
  });
  if (!resposta.ok) throw new RenovacaoRecusadaError(resposta.status, await extrairErro(resposta));
  const j = (await resposta.json()) as {
    access_token: string;
    refresh_token: string;
    user_id?: number;
  };
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    userId: j.user_id != null ? String(j.user_id) : undefined,
  };
}

/**
 * Quais atributos, POR CATEGORIA, o próprio ML tira da ficha do comprador.
 *
 * `GET /categories/{id}/attributes` é PÚBLICO — sem token, sem rotação, sem
 * efeito colateral. E ele responde a pergunta que eu vinha respondendo por
 * conta própria com uma lista de nomes que eu conhecia:
 *
 *   hidden               o ML nem mostra ao comprador (embalagem do vendor,
 *                        condição do item, metadados de logística)
 *   variation_attribute  varia POR VARIAÇÃO, por desenho — cada tamanho tem sua
 *                        linha na guia. Chamar isso de discordância entre
 *                        anúncios do mesmo produto é acusar dois sapatos de
 *                        discordarem sobre o número.
 *
 * Medido em MLB273770: 65 dos 78 atributos caem numa das duas.
 *
 * FALHA ABERTA. Se o ML não responder para uma categoria, ela volta VAZIA — e
 * os atributos passam. Esconder sem saber seria afirmar o que não se sabe, que
 * é a regra do INC-009; e o preço de errar para o lado aberto é ruído na tela,
 * não dado perdido.
 */
export async function atributosForaDaFicha(
  categorias: readonly string[]
): Promise<Record<string, string[]>> {
  const unicas = [...new Set(categorias.filter(Boolean))];
  const fora: Record<string, string[]> = {};
  await Promise.all(
    unicas.map(async (categoria) => {
      try {
        const r = await fetch(`${API}/categories/${encodeURIComponent(categoria)}/attributes`);
        if (!r.ok) {
          fora[categoria] = [];
          return;
        }
        const lista = (await r.json()) as { id?: string; tags?: Record<string, unknown> }[];
        if (!Array.isArray(lista)) {
          fora[categoria] = [];
          return;
        }
        fora[categoria] = lista
          .filter((a) => a.tags && ("hidden" in a.tags || "variation_attribute" in a.tags))
          .map((a) => a.id ?? "")
          .filter(Boolean);
      } catch {
        // Rede/ML fora: a categoria não esconde nada. Ver "falha aberta" acima.
        fora[categoria] = [];
      }
    })
  );
  return fora;
}

/**
 * O que a categoria EXIGE — `tags.required`, do mesmo endpoint público.
 *
 * Devolve `[]` quando o ML não responde, e isso é deliberado: sem confirmação,
 * não se bloqueia nada. Afirmar uma exigência que ninguém confirmou é o defeito
 * que o DES-001 arrancou do A10; o ML continua sendo a última palavra.
 */
export async function atributosObrigatorios(
  categoria: string
): Promise<{ id: string; nome: string }[]> {
  if (!categoria) return [];
  try {
    const r = await fetch(`${API}/categories/${encodeURIComponent(categoria)}/attributes`);
    if (!r.ok) return [];
    const lista = (await r.json()) as { id?: string; name?: string; tags?: Record<string, unknown> }[];
    if (!Array.isArray(lista)) return [];
    return lista
      .filter((a) => a.tags && "required" in a.tags && a.id)
      .map((a) => ({ id: a.id as string, nome: a.name || (a.id as string) }));
  } catch {
    return [];
  }
}

/** Prediz a categoria (category_id) a partir do título. null se não achar. */
export async function preverCategoria(accessToken: string, titulo: string): Promise<string | null> {
  const url = `${API}/sites/MLB/domain_discovery/search?limit=1&q=${encodeURIComponent(titulo)}`;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return null;
    const j = (await r.json()) as { category_id?: string }[];
    return j?.[0]?.category_id ?? null;
  } catch {
    return null;
  }
}

export interface ResultadoItemML {
  id: string;
  permalink: string;
  status: string;
}

/** Cria o item no ML (POST /items). Lança erro com a causa do ML se falhar. */
export async function criarItem(
  accessToken: string,
  item: Record<string, unknown>
): Promise<ResultadoItemML> {
  const r = await fetch(`${API}/items`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(item),
  });
  if (!r.ok) throw new Error(`ML recusou o anúncio: ${await extrairErro(r)}`);
  const j = (await r.json()) as { id: string; permalink: string; status: string };
  return { id: j.id, permalink: j.permalink, status: j.status };
}

/**
 * ENCERRA um anúncio no Mercado Livre (status "closed").
 *
 * Usado na migração de anúncio: republicar é estratégia legítima do lojista —
 * editar o título de um anúncio vivo reseta o histórico de relevância —, mas
 * manter DOIS anúncios ativos do mesmo produto, nas mesmas condições, infringe
 * a política do ML e pode custar o anúncio ou a conta. Encerrar o antigo é o
 * que separa a migração legítima da duplicidade punível.
 *
 * "closed" é terminal no ML: o anúncio sai do ar e não volta. Por isso esta
 * função nunca é chamada por inferência — só por decisão explícita de quem vende.
 */
export async function encerrarItem(
  accessToken: string,
  itemId: string
): Promise<{ id: string; status: string }> {
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "closed" }),
  });
  if (!r.ok) throw new Error(`ML recusou encerrar o anúncio ${itemId}: ${await extrairErro(r)}`);
  const j = (await r.json()) as { id: string; status: string };
  return { id: j.id, status: j.status };
}

/**
 * Tira do ar (`paused`) ou devolve ao ar (`active`) um anúncio.
 *
 * ===========================================================================
 * POR QUE ISTO PRECISOU EXISTIR
 * ===========================================================================
 *
 * 2026-08-01: a lojista publicou o Papete Modare e pediu para pausá-lo — as
 * fotos estavam com a cor errada. O Zion não sabia pausar. Só sabia
 * `encerrarItem`, que é TERMINAL: o anúncio sai do ar e NÃO VOLTA, levando
 * junto o histórico de relevância que ele acumulou.
 *
 * Sem pausar, a única saída dentro do sistema era destruir o anúncio para
 * corrigir uma foto. Ela teve que ir ao painel do ML fazer à mão.
 *
 * `paused` é REVERSÍVEL, e essa é a diferença inteira. Um anúncio pausado sai
 * da vitrine, mantém o id, mantém o histórico e volta com `active`.
 *
 * A função NÃO decide qual estado usar: quem chama diz. Inferir "acho que ela
 * quer pausar" é exatamente a classe de erro que o resto deste arquivo
 * combate.
 */
export async function definirEstadoDoItem(
  accessToken: string,
  itemId: string,
  estado: "paused" | "active"
): Promise<{ id: string; status: string }> {
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: estado }),
  });
  if (!r.ok) {
    const acao = estado === "paused" ? "pausar" : "reativar";
    throw new Error(`ML recusou ${acao} o anúncio ${itemId}: ${await extrairErro(r)}`);
  }
  const j = (await r.json()) as { id: string; status: string };
  // Devolvemos o status que o ML CONFIRMOU, não o que pedimos. O ML pode
  // responder `under_review` a uma reativação, e fingir `active` aqui plantaria
  // no banco um estado que não é o real.
  return { id: j.id, status: j.status };
}

// ---- Custos e reputação (a fonte da verdade sobre o que o ML cobra) ---------

export interface TarifaDeVenda {
  /** `sale_fee_details.percentage_fee` — o % que o ML aplica sobre o preço. */
  percentual: number;
  /** `sale_fee_details.fixed_fee` — zero em ME2 sem Flex, mas não assumimos. */
  taxaFixa: number;
  /** `sale_fee_amount` — o total em reais para o preço consultado. */
  valorTotal: number;
  listingTypeId: string;
}

/**
 * Tarifa de venda REAL para uma categoria, do próprio ML.
 *
 * Substitui qualquer tabela de comissão nossa: a resposta é da categoria exata
 * do produto, não de uma média de "Moda". Exige token — o endpoint recusa
 * chamadas anônimas (403 PolicyAgent).
 *
 * Os parâmetros de logística importam: desde a nova estrutura de custos o ML
 * calcula a taxa fixa também pelo modo de envio, e omiti-los devolve um número
 * que não coincide com o cobrado de verdade.
 */
export async function consultarTarifaDeVenda(
  accessToken: string,
  opcoes: {
    categoryId: string;
    preco: number;
    listingTypeId: string;
    /** Modo de envio do anúncio. O payload da Zion publica sempre como me2. */
    shippingMode?: string;
    /** Coleta (cross_docking) é o padrão do fluxo; Flex muda a taxa fixa. */
    logisticType?: string;
    siteId?: string;
  }
): Promise<TarifaDeVenda> {
  const site = opcoes.siteId ?? "MLB";
  const q = new URLSearchParams({
    price: String(opcoes.preco),
    currency_id: "BRL",
    category_id: opcoes.categoryId,
    listing_type_id: opcoes.listingTypeId,
    shipping_mode: opcoes.shippingMode ?? "me2",
    logistic_type: opcoes.logisticType ?? "cross_docking",
  });
  const r = await fetch(`${API}/sites/${site}/listing_prices?${q}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`ML recusou consultar a tarifa: ${await extrairErro(r)}`);

  // A resposta é um ARRAY (um item por listing_type quando não se filtra).
  const corpo = (await r.json()) as unknown;
  const lista = Array.isArray(corpo) ? corpo.flat() : [corpo];
  const alvo = (lista as Record<string, unknown>[]).find(
    (x) => x && x.listing_type_id === opcoes.listingTypeId
  ) ?? (lista[0] as Record<string, unknown> | undefined);
  if (!alvo) throw new Error("O ML respondeu sem nenhuma tarifa para esta categoria.");

  const det = (alvo.sale_fee_details ?? {}) as Record<string, unknown>;
  const num = (v: unknown): number => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    percentual: num(det.percentage_fee),
    taxaFixa: num(det.fixed_fee),
    valorTotal: num(alvo.sale_fee_amount),
    listingTypeId: String(alvo.listing_type_id ?? opcoes.listingTypeId),
  };
}

export interface ReputacaoVendedor {
  /** "5_green", "4_light_green", "3_yellow", "2_orange", "1_red" ou null. */
  levelId: string | null;
  /** "silver" | "gold" | "platinum" quando é MercadoLíder. */
  powerSellerStatus: string | null;
  /** Nível real durante período de proteção — só aparece se protegido. */
  levelReal: string | null;
  sellerId: string | null;
}

/**
 * Reputação do vendedor conectado. É o que decide qual das três tabelas de
 * custo de envio vale — e é dado do ML, não configuração que o cliente digita
 * (e erraria).
 */
export async function consultarReputacao(accessToken: string): Promise<ReputacaoVendedor> {
  const r = await fetch(`${API}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`ML recusou consultar a reputação: ${await extrairErro(r)}`);
  const j = (await r.json()) as {
    id?: number | string;
    seller_reputation?: {
      level_id?: string | null;
      power_seller_status?: string | null;
      real_level?: string | null;
    };
  };
  const rep = j.seller_reputation ?? {};
  return {
    levelId: rep.level_id ?? null,
    powerSellerStatus: rep.power_seller_status ?? null,
    levelReal: rep.real_level ?? null,
    sellerId: j.id != null ? String(j.id) : null,
  };
}

// ---- Pedidos / vendas (para o dashboard de métricas) ----

export interface ItemPedidoML {
  itemId: string;
  sku: string;
  titulo: string;
  qtd: number;
  precoUnit: number;
}

export interface PedidoML {
  id: string;
  data: string; // ISO (date_created / date_closed)
  status: string;
  total: number; // total_amount pago
  taxas: number; // soma das sale_fee (comissão ML)
  itens: ItemPedidoML[];
}

interface OrderRaw {
  id: number | string;
  status?: string;
  date_created?: string;
  date_closed?: string;
  total_amount?: number;
  order_items?: {
    item?: { id?: string; title?: string; seller_sku?: string; seller_custom_field?: string };
    quantity?: number;
    unit_price?: number;
    sale_fee?: number;
  }[];
}

/**
 * Busca os pedidos PAGOS do vendedor desde `desde` (ISO). Pagina até um teto
 * (para caber no serverless). Devolve um formato enxuto para o cálculo.
 */
export async function buscarPedidosML(
  accessToken: string,
  sellerId: string,
  opcoes: { desde?: string; maxPedidos?: number } = {}
): Promise<PedidoML[]> {
  const limit = 50;
  const teto = opcoes.maxPedidos ?? 300;
  const pedidos: PedidoML[] = [];
  let offset = 0;

  while (pedidos.length < teto) {
    const url = new URL(`${API}/orders/search`);
    url.searchParams.set("seller", sellerId);
    url.searchParams.set("order.status", "paid");
    url.searchParams.set("sort", "date_desc");
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    if (opcoes.desde) url.searchParams.set("order.date_created.from", opcoes.desde);

    const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!r.ok) throw new Error(`Falha ao buscar vendas do ML: ${await extrairErro(r)}`);
    const data = (await r.json()) as { results?: OrderRaw[]; paging?: { total?: number } };
    const results = data.results ?? [];
    if (results.length === 0) break;

    for (const o of results) {
      const itens = (o.order_items ?? []).map((oi) => ({
        itemId: oi.item?.id ?? "",
        sku: (oi.item?.seller_sku || oi.item?.seller_custom_field || "").trim(),
        titulo: oi.item?.title ?? "",
        qtd: Number(oi.quantity ?? 0),
        precoUnit: Number(oi.unit_price ?? 0),
      }));
      pedidos.push({
        id: String(o.id),
        data: o.date_closed || o.date_created || "",
        status: o.status ?? "paid",
        total: Number(o.total_amount ?? 0),
        taxas: (o.order_items ?? []).reduce((s, oi) => s + Number(oi.sale_fee ?? 0), 0),
        itens,
      });
    }

    offset += limit;
    const total = data.paging?.total ?? 0;
    if (offset >= total) break;
  }

  return pedidos;
}

// ---- Importar anúncios já cadastrados na conta do vendedor ----

export interface VariacaoAnuncioML {
  cor: string;
  tamanho: string;
  sku: string;
  ean: string;
  preco: number;
  estoque: number;
}

/**
 * Um atributo do item, como o Mercado Livre o devolveu.
 *
 * `nome` é o rótulo em português que o ML já traduz ("Material da sola"); `id` é
 * a chave estável ("OUTSOLE_MATERIAL"). Guardamos os dois: o nome é o que o
 * lojista lê, o id é o que sobrevive a mudanças de rótulo.
 */
export interface AtributoML {
  id: string;
  nome: string;
  valor: string;
}

export interface AnuncioML {
  mlb: string;
  /**
   * TODOS os atributos preenchidos do item, sem escolha nossa.
   *
   * Existe porque até 2026-08-01 o mapeamento extraía só os ids que conhecia e
   * o resto era descartado em silêncio — material da sola, palmilha, tipo de
   * salto, gênero, tipo de calçado chegavam do ML e morriam aqui. Medido: 500
   * dos 501 anúncios importados ficaram com dois atributos.
   *
   * A lista é FIEL: quem quiser filtrar filtra na hora de exibir, não aqui.
   * Descartar na origem foi exatamente o defeito.
   */
  atributos: AtributoML[];
  titulo: string;
  categoria: string; // category_id
  preco: number;
  estoque: number;
  status: string;
  permalink: string;
  sku: string; // seller_custom_field / SELLER_SKU
  marca: string;
  modelo: string;
  fotos: string[];
  variacoes: VariacaoAnuncioML[];
  // Modelo User Products (ex.: chinelo): cada tamanho é um MLB separado,
  // agrupado por família. Usamos isso para reunir os "SKUs separados".
  familyId: string; // user_product_id
  familyName: string; // family_name
  cor: string; // COLOR do item (quando não há variações internas)
  tamanho: string; // SIZE do item
  ean: string; // GTIN do item
  /**
   * O VENDEDOR paga o frete deste anúncio?
   *
   * `undefined` quando o item não informou — e aí quem consome ASSUME que paga,
   * que é a direção segura. Sem este campo o cálculo descontava frete de todo
   * anúncio, inclusive daqueles em que o comprador paga: margem menor que a
   * real, sem ninguém saber por quê.
   */
  vendedorPagaFrete?: boolean;
  /**
   * Medidas da EMBALAGEM. O ML é a fonte: o custo de envio sai do peso cobrável
   * (o maior entre real e cubado), e sem isso a precificação fica cega.
   * Peso em GRAMAS e dimensões em CM — as unidades que o ML usa.
   */
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
}

interface ItemRaw {
  id?: string;
  title?: string;
  category_id?: string;
  price?: number;
  available_quantity?: number;
  status?: string;
  permalink?: string;
  seller_custom_field?: string;
  family_name?: string | null;
  user_product_id?: string | null;
  // `name` é o rótulo já traduzido pelo ML ("Material da sola"). Ele sempre
  // veio na resposta; só nunca foi declarado aqui, porque nada o lia.
  attributes?: { id?: string; name?: string; value_name?: string | null }[];
  shipping?: { dimensions?: string | null; free_shipping?: boolean; logistic_type?: string };
  pictures?: { url?: string; secure_url?: string }[];
  variations?: {
    price?: number;
    available_quantity?: number;
    seller_custom_field?: string;
    attribute_combinations?: { id?: string; value_name?: string | null }[];
    attributes?: { id?: string; value_name?: string | null }[];
  }[];
}

function attr(attrs: { id?: string; value_name?: string | null }[] | undefined, id: string): string {
  return (attrs ?? []).find((a) => a.id === id)?.value_name?.trim() || "";
}

export interface MedidasDaEmbalagem {
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
}

const SEM_MEDIDAS: MedidasDaEmbalagem = {
  pesoGramas: 0,
  alturaCm: 0,
  larguraCm: 0,
  comprimentoCm: 0,
};

/**
 * Lê as medidas da embalagem de um item do ML. PURA.
 *
 * Duas fontes, nesta ordem:
 *   1. `shipping.dimensions` — "AxBxC,peso" com dimensões em cm e peso em gramas
 *      (documentação de Atributos de envio e dimensões).
 *   2. os atributos PACKAGE_HEIGHT / _WIDTH / _LENGTH / _WEIGHT, que alguns
 *      itens trazem no lugar.
 *
 * Zero em tudo quando nenhuma fonte responde — e zero significa "não sei",
 * tratado como pendência pela precificação, nunca como "não pesa nada".
 */
export function medidasDoItem(it: {
  shipping?: { dimensions?: string | null };
  attributes?: { id?: string; value_name?: string | null }[];
}): MedidasDaEmbalagem {
  const dim = (it.shipping?.dimensions ?? "").trim();
  if (dim) {
    // "30x20x10,1000" → altura x largura x comprimento, peso.
    //
    // A vírgula é separadora do peso E pode ser decimal dentro das dimensões
    // ("30,5x20x10,450"). Dividir pela ÚLTIMA resolve a ambiguidade: o que vem
    // depois é sempre o peso, o que vem antes são sempre as três dimensões.
    const corte = dim.lastIndexOf(",");
    const medidas = corte >= 0 ? dim.slice(0, corte) : dim;
    const peso = corte >= 0 ? dim.slice(corte + 1) : "";
    const partes = medidas.split(/x/i).map((n) => Number(String(n).trim().replace(",", ".")));
    if (partes.length === 3 && partes.every((n) => Number.isFinite(n))) {
      return {
        alturaCm: Math.max(0, partes[0]),
        larguraCm: Math.max(0, partes[1]),
        comprimentoCm: Math.max(0, partes[2]),
        pesoGramas: Math.max(0, Number(String(peso ?? "").replace(",", ".")) || 0),
      };
    }
  }

  // Fallback pelos atributos. `value_name` costuma vir com unidade ("450 g").
  const numero = (v: string): number => {
    const n = parseFloat(String(v).replace(",", "."));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  };
  const pesoAttr = attr(it.attributes, "PACKAGE_WEIGHT");
  // O ML pode devolver o peso em kg ("0.45 kg"); normalizamos para gramas.
  const pesoBruto = numero(pesoAttr);
  const pesoGramas = /kg/i.test(pesoAttr) ? pesoBruto * 1000 : pesoBruto;
  const medidas: MedidasDaEmbalagem = {
    pesoGramas,
    alturaCm: numero(attr(it.attributes, "PACKAGE_HEIGHT")),
    larguraCm: numero(attr(it.attributes, "PACKAGE_WIDTH")),
    comprimentoCm: numero(attr(it.attributes, "PACKAGE_LENGTH")),
  };
  const temAlgo =
    medidas.pesoGramas > 0 ||
    medidas.alturaCm > 0 ||
    medidas.larguraCm > 0 ||
    medidas.comprimentoCm > 0;
  return temAlgo ? medidas : SEM_MEDIDAS;
}

function mapearItem(it: ItemRaw): AnuncioML {
  const variacoes: VariacaoAnuncioML[] = (it.variations ?? []).map((v) => ({
    cor: attr(v.attribute_combinations, "COLOR"),
    tamanho: attr(v.attribute_combinations, "SIZE"),
    sku: (v.seller_custom_field || attr(v.attributes, "SELLER_SKU") || "").trim(),
    ean: attr(v.attributes, "GTIN"),
    preco: Number(v.price ?? it.price ?? 0),
    estoque: Number(v.available_quantity ?? 0),
  }));
  // Sem escolher: tudo o que veio preenchido. Um atributo sem `value_name` é
  // um campo que o ML conhece e o anúncio não respondeu — guardá-lo vazio faria
  // a ficha listar dezenas de linhas em branco.
  const atributos: AtributoML[] = (it.attributes ?? [])
    .map((a) => ({
      id: (a.id ?? "").trim(),
      nome: (a.name ?? "").trim(),
      valor: (a.value_name ?? "").trim(),
    }))
    .filter((a) => a.id && a.valor);

  return {
    mlb: it.id ?? "",
    atributos,
    // O ML devolve `free_shipping` como booleano. Ausente = não informado, e
    // não "falso": undefined faz o cálculo assumir que o vendedor paga.
    ...(typeof it.shipping?.free_shipping === "boolean"
      ? { vendedorPagaFrete: it.shipping.free_shipping }
      : {}),
    titulo: it.title ?? "",
    categoria: it.category_id ?? "",
    preco: Number(it.price ?? 0),
    estoque: Number(it.available_quantity ?? 0),
    status: it.status ?? "",
    permalink: it.permalink ?? "",
    sku: (it.seller_custom_field || attr(it.attributes, "SELLER_SKU") || "").trim(),
    marca: attr(it.attributes, "BRAND"),
    modelo: attr(it.attributes, "MODEL"),
    fotos: (it.pictures ?? []).map((p) => p.secure_url || p.url || "").filter(Boolean),
    variacoes,
    ...medidasDoItem(it),
    familyId: (it.user_product_id ?? "").toString().trim(),
    familyName: (it.family_name ?? "").trim(),
    cor: attr(it.attributes, "COLOR"),
    tamanho: attr(it.attributes, "SIZE"),
    ean: attr(it.attributes, "GTIN"),
  };
}

/**
 * A parede que interrompeu a leitura, quando ela não leu tudo.
 *
 * `offset-1000` é do ML, não nossa: o `/items/search` clássico recusa
 * `offset >= 1000`. Acima disso o ML exige `search_type=scan` com `scroll_id`,
 * que NÃO está implementado aqui — implementar às cegas significaria estrear em
 * produção, na conta de um cliente. Enquanto não estiver, a parede é dita.
 */
export type ParedeDaLeitura = "nenhuma" | "offset-1000" | "teto" | "paginacao-parou";

/** O limite do `/items/search` clássico do ML. */
const OFFSET_MAXIMO_ML = 1000;

export interface LeituraDoVendedor {
  anuncios: AnuncioML[];
  /** Quantos o ML DIZ que a conta tem (`paging.total`). -1 = não informou. */
  total: number;
  /** Quantos ids conseguimos listar. */
  ids: number;
  /** Ids listados que o multiget não devolveu (lote com falha, ou code != 200). */
  perdidos: number;
  parede: ParedeDaLeitura;
}

/**
 * Lista os MLBs do vendedor e busca cada um (multiget de 20 em 20).
 *
 * ===========================================================================
 * POR QUE ISTO DEVOLVE UM OBJETO, E NÃO UM ARRAY
 * ===========================================================================
 *
 * Até 2026-08-01 esta função tinha `const teto = opcoes.max ?? 500`, o único
 * chamador não passava `opcoes`, e o laço parava nos 500 — CALADO. Observado em
 * produção no mesmo dia: a importação trouxe 489 já conhecidos + 11 novos = 500
 * exatos, e a tela disse "489 já existiam", que se lê como "está tudo em dia".
 * O ERP da lojista listava 561.
 *
 * O `paging.total` estava na resposta o tempo todo. O laço lia esse campo só
 * para parar mais cedo, e jogava fora.
 *
 * Então o array não serve mais como retorno: quem chama precisa poder comparar
 * o que o ML DIZ ter com o que nós LEMOS. Um array não carrega essa diferença,
 * e foi por isso que ela ficou invisível por meses.
 */
export async function buscarAnunciosDoVendedor(
  accessToken: string,
  sellerId: string,
  opcoes: { max?: number } = {}
): Promise<LeituraDoVendedor> {
  const teto = opcoes.max ?? Infinity;
  const headers = { Authorization: `Bearer ${accessToken}` };

  // 1) Coleta os ids (paginado), até o fim — ou até uma parede, que é NOMEADA.
  const ids: string[] = [];
  let total = -1;
  let offset = 0;
  let parede: ParedeDaLeitura = "nenhuma";
  for (;;) {
    if (ids.length >= teto) {
      parede = "teto";
      break;
    }
    if (offset >= OFFSET_MAXIMO_ML) {
      parede = "offset-1000";
      break;
    }
    const url = `${API}/users/${sellerId}/items/search?limit=50&offset=${offset}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`Falha ao listar anúncios do ML: ${await extrairErro(r)}`);
    const d = (await r.json()) as { results?: string[]; paging?: { total?: number } };
    if (total < 0 && typeof d.paging?.total === "number") total = d.paging.total;
    const results = d.results ?? [];
    // Página vazia ANTES de chegar ao total é uma parede também — o ML parou de
    // devolver sem dizer por quê. Antes isso era um `break` mudo.
    if (results.length === 0) {
      if (total >= 0 && ids.length < total) parede = "paginacao-parou";
      break;
    }
    ids.push(...results);
    offset += 50;
    if (total >= 0 && ids.length >= total) break;
  }

  // 2) Multiget (20 por vez) com os campos que interessam.
  const anuncios: AnuncioML[] = [];
  const campos =
    "id,title,price,available_quantity,category_id,status,permalink,seller_custom_field,family_name,user_product_id,attributes,pictures,variations";
  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20).join(",");
    const r = await fetch(`${API}/items?ids=${lote}&attributes=${campos}`, { headers });
    // Um lote que falha derrubava até 20 anúncios sem uma linha de aviso. Ele
    // continua não derrubando a importação inteira — mas agora é CONTADO.
    if (!r.ok) continue;
    const arr = (await r.json()) as { code?: number; body?: ItemRaw }[];
    for (const x of arr) {
      if (x.code === 200 && x.body?.id) anuncios.push(mapearItem(x.body));
    }
  }

  return { anuncios, total, ids: ids.length, perdidos: ids.length - anuncios.length, parede };
}

// ---- Guia de tamanhos (SIZE_GRID) — modelo User Products ----

export interface LinhaGuiaTamanho {
  tamanho: string;
  /** Comprimento do pé em cm (tabela de medidas do fornecedor). */
  footLengthCm: number;
}

export interface GuiaTamanhos {
  gridId: string;
  /** tamanho → SIZE_GRID_ROW_ID. */
  rowIdPorTamanho: Record<string, string>;
}

/**
 * Cria a guia de tamanhos via POST /catalog/charts. Formato confirmado no
 * diário da Chinelaria: todo atributo usa `values: [{...}]`; BR_SIZE leva o
 * sufixo " BR"; FOOT_LENGTH/FOOT_LENGTH_TO em cm (faixa ±0,2 em torno do valor).
 * Retorna o gridId (SIZE_GRID_ID) e o mapa tamanho → SIZE_GRID_ROW_ID.
 */
export async function criarGuiaTamanhos(
  accessToken: string,
  dados: {
    nome: string;
    domainId: string; // ex.: "SANDALS_AND_CLOGS"
    siteId?: string; // "MLB"
    generoId: string;
    generoNome: string;
    linhas: LinhaGuiaTamanho[];
    /** Vendedor (seller_id). Habilita a busca de guia reutilizável (idempotência). */
    sellerId?: string | number;
    /** Correlação de logs com a publicação (observabilidade). */
    publishId?: string;
  }
): Promise<GuiaTamanhos> {
  const siteId = dados.siteId ?? "MLB";

  // ── IDEMPOTÊNCIA das Size Charts criadas pelo ZION ──────────────────────────
  // Recriar a guia a cada publish colide (chart_name_unavailable) porque o nome
  // é determinístico (marca + família) e o ML impõe nome ÚNICO por
  // (seller, domínio, características). Solução: DESCOBRIR via o endpoint oficial
  // POST /catalog/charts/search se já existe uma guia NOSSA equivalente e
  // reutilizá-la; só criar se não existir. GET/rows/createItem abaixo ficam
  // inalterados — muda apenas a decisão "reutilizar" vs "criar".
  //
  // Contrato empírico da API (conta real, SANDALS_AND_CLOGS):
  //  • sucesso = { paging:{total,offset,limit}, charts:[…] }; GENDER é OBRIGATÓRIO;
  //  • a busca devolve a CLASSE inteira (N guias) → paginação real (limit=100);
  //  • item traz names["MLB"], main_attribute_id, attributes, rows;
  //  • guia LEGADA (painel ML) usa main_attribute_id="BR_SIZE"; a NOSSA usa
  //    "MANUFACTURER_SIZE" → é esse o filtro anti-legado (este PR NÃO reutiliza
  //    guia legada nem adapta BR_SIZE/SIZE; isso é outro PR).

  const nomeComparado = normalizarNomeGuia(dados.nome);

  type ChartBusca = {
    id?: string;
    names?: Record<string, string>;
    main_attribute_id?: string;
  };
  interface RespostaBusca {
    encontrada: string | null;
    buscaStatus: string;
    candidatos: number;
    paginasConsultadas: number;
    paginaAtual: number | null;
  }

  // Busca PAGINADA por uma guia NOSSA cujo nome (normalizado) bate com o desejado.
  // Itera offset/limit até achar ou esgotar paging.total.
  async function buscarGuiaZion(): Promise<RespostaBusca> {
    if (dados.sellerId == null || !String(dados.sellerId).trim()) {
      return { encontrada: null, buscaStatus: "ignorada_sem_seller", candidatos: 0, paginasConsultadas: 0, paginaAtual: null };
    }
    const limit = 100;
    let offset = 0;
    let total = Infinity;
    let candidatos = 0;
    let paginas = 0;
    const MAX_PAGINAS = 100; // trava de segurança (10k guias) — não deve ser atingida.
    while (offset < total && paginas < MAX_PAGINAS) {
      let resp: Response;
      try {
        resp = await fetch(`${API}/catalog/charts/search?limit=${limit}&offset=${offset}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            site_id: siteId,
            domain_id: dados.domainId,
            seller_id: dados.sellerId,
            type: "SPECIFIC",
            attributes: [{ id: "GENDER", values: [{ id: dados.generoId }] }],
          }),
        });
      } catch {
        return { encontrada: null, buscaStatus: "erro_rede", candidatos, paginasConsultadas: paginas, paginaAtual: null };
      }
      if (!resp.ok) {
        return { encontrada: null, buscaStatus: `http_${resp.status}`, candidatos, paginasConsultadas: paginas, paginaAtual: null };
      }
      const j = (await resp.json()) as { paging?: { total?: number }; charts?: ChartBusca[] };
      const charts = j.charts ?? [];
      total = j.paging?.total ?? offset + charts.length;
      paginas++;
      for (const c of charts) {
        candidatos++;
        // Filtro anti-legado: só considera guias do PADRÃO ZION.
        if (c.main_attribute_id !== "MANUFACTURER_SIZE") continue;
        if (c.id && normalizarNomeGuia(c.names?.[siteId]) === nomeComparado) {
          return { encontrada: c.id, buscaStatus: "ok", candidatos, paginasConsultadas: paginas, paginaAtual: paginas };
        }
      }
      if (charts.length === 0) break; // defensivo: página vazia encerra.
      offset += limit;
    }
    return { encontrada: null, buscaStatus: "ok", candidatos, paginasConsultadas: paginas, paginaAtual: null };
  }

  // 1) Tenta REUTILIZAR uma guia nossa.
  const busca1 = await buscarGuiaZion();
  let chartId: string | null = busca1.encontrada;
  let origem: "reuse" | "create" = chartId ? "reuse" : "create";
  let motivo = chartId ? "guia_existente" : "produto_novo";
  let buscaStatus = busca1.buscaStatus;
  let candidatosEncontrados = busca1.candidatos;
  let paginasConsultadas = busca1.paginasConsultadas;
  let paginaAtual = busca1.paginaAtual;

  // 2) Não achou → CRIA. Se colidir (corrida concorrente criou entre a busca e o
  //    create), REBUSCA e reutiliza; só falha se realmente não existir.
  if (!chartId) {
    const rows = dados.linhas.map((l) => ({
      attributes: [
        { id: "MANUFACTURER_SIZE", values: [{ name: String(l.tamanho) }] },
        { id: "BR_SIZE", values: [{ name: `${l.tamanho} BR` }] },
        { id: "FOOT_LENGTH", values: [{ name: `${(l.footLengthCm - 0.2).toFixed(1)} cm` }] },
        { id: "FOOT_LENGTH_TO", values: [{ name: `${(l.footLengthCm + 0.2).toFixed(1)} cm` }] },
      ],
    }));

    const body = {
      names: { [siteId]: dados.nome },
      domain_id: dados.domainId,
      site_id: siteId,
      type: "SPECIFIC",
      main_attribute: { attributes: [{ site_id: siteId, id: "MANUFACTURER_SIZE" }] },
      attributes: [{ id: "GENDER", values: [{ id: dados.generoId, name: dados.generoNome }] }],
      rows,
    };

    const r = await fetch(`${API}/catalog/charts`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (r.ok) {
      chartId = ((await r.json()) as { id: string }).id;
      origem = "create";
      motivo = "criada";
    } else {
      // Corpo lido como TEXTO: detecta o code de forma robusta (independe do
      // envelope) e evita reconsumir a Response.
      const corpoErro = await r.text();
      if (/chart_name_unavailable/i.test(corpoErro)) {
        // Outra execução concorrente criou a guia entre a nossa busca e o create.
        const busca2 = await buscarGuiaZion();
        buscaStatus = busca2.buscaStatus;
        candidatosEncontrados = busca2.candidatos;
        paginasConsultadas = busca2.paginasConsultadas;
        paginaAtual = busca2.paginaAtual;
        if (busca2.encontrada) {
          chartId = busca2.encontrada;
          origem = "reuse";
          motivo = "rebusca_pos_colisao";
        } else {
          throw new Error(
            `chart_name_unavailable, mas a rebusca não localizou a guia (nome="${nomeComparado}").`
          );
        }
      } else {
        throw new Error(
          `Falha ao criar a guia de tamanhos: ${mensagemErroTexto(corpoErro, r.status)}`
        );
      }
    }
  }

  // Id definido (reuse ou create) — const estável para o closure abaixo.
  const gridId: string = chartId;

  // O ML NÃO garante os row ids na resposta do POST (a guia é validada de forma
  // assíncrona). A fonte OFICIAL é o GET /catalog/charts/{id}. Buscamos os rows
  // com retry curto e mapeamos por MANUFACTURER_SIZE — nunca por índice.
  type RowGuia = {
    id?: string;
    attributes?: { id: string; values?: { name?: string }[] }[];
  };

  async function buscarRowsOficiais(): Promise<RowGuia[]> {
    for (let tentativa = 0; tentativa < 3; tentativa++) {
      if (tentativa > 0) await new Promise((res) => setTimeout(res, 400));
      const g = await fetch(`${API}/catalog/charts/${gridId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!g.ok) continue;
      const gj = (await g.json()) as { rows?: RowGuia[] };
      const rows = gj.rows ?? [];
      if (rows.length > 0 && rows.every((x) => Boolean(x.id))) return rows;
    }
    return [];
  }

  const rowsOficiais = await buscarRowsOficiais();

  // MANUFACTURER_SIZE (o tamanho que enviamos) → row id oficial do ML.
  const idPorTamanhoOficial: Record<string, string> = {};
  for (const row of rowsOficiais) {
    const ms = row.attributes?.find((a) => a.id === "MANUFACTURER_SIZE");
    const nome = ms?.values?.[0]?.name;
    if (nome && row.id) idPorTamanhoOficial[String(nome)] = row.id;
  }

  const rowIdPorTamanho: Record<string, string> = {};
  let viaFallback = 0;
  dados.linhas.forEach((l, i) => {
    const oficial = idPorTamanhoOficial[String(l.tamanho)];
    if (oficial) {
      rowIdPorTamanho[String(l.tamanho)] = oficial;
    } else {
      // Rede de segurança: só quando o GET falha / não tem rows / tamanho ausente.
      rowIdPorTamanho[String(l.tamanho)] = `${gridId}:${i + 1}`;
      viaFallback++;
    }
  });

  // Observabilidade completa da decisão (create|reuse) + origem dos row ids.
  // `origem:"reuse"` confirma a idempotência; `motivo` distingue produto novo,
  // guia existente e rebusca pós-colisão concorrente.
  console.log(
    JSON.stringify({
      src: "ml.guia",
      publishId: dados.publishId ?? null,
      chartId: gridId,
      origem,
      motivo,
      buscaStatus,
      candidatosEncontrados,
      paginaAtual,
      paginasConsultadas,
      nomeComparado,
      source: viaFallback === 0 && rowsOficiais.length > 0 ? "GET" : "fallback",
      tamanhos: dados.linhas.length,
      viaFallback,
    })
  );

  return { gridId, rowIdPorTamanho };
}
