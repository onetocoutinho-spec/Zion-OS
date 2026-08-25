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
 * Qualquer coisa vira texto aparado — sem supor o tipo.
 *
 * Observado em 02/08/2026: `familiaIdDoML: (it.family_id ?? "").trim()` estourou
 * com "(t.family_id ?? '').trim is not a function", porque `family_id` vem como
 * NÚMERO. A exceção era capturada como "lote recusado", a leitura degradava, e
 * a mensagem acusava o Mercado Livre de recusar campos que ele nunca recusou.
 *
 * O `?? ""` só protege contra `null`/`undefined` — não contra tipo diferente do
 * esperado. Numa fronteira que não controlamos, supor o tipo é o mesmo que
 * supor o valor.
 */
function texto(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

export interface RecorteDaCategoria {
  /** ids `hidden` ou `variation_attribute` — não são ficha do lojista. */
  foraDaFicha: Record<string, string[]>;
  /** ids `required` — o que a categoria EXIGE, por categoria. */
  obrigatorios: Record<string, { id: string; nome: string }[]>;
}

/**
 * Os dois recortes da categoria, numa passada só.
 *
 * `atributosForaDaFicha` e `atributosObrigatorios` leem o MESMO endpoint
 * (`/categories/{id}/attributes`) e olham tags diferentes da mesma resposta.
 * Chamar os dois dobraria a rede por nada.
 *
 * Existe porque a medição precisou dos obrigatórios: em 2026-08-01 a conta da
 * Chinelaria tinha 150 anúncios em `waiting_for_patch` — o ML pedindo uma
 * correção — e ninguém sabia QUAL campo. O ML publica a lista de exigências
 * nesta mesma resposta.
 *
 * Falha ABERTA, igual às duas originais: categoria que não responde entra com
 * listas vazias. Sem confirmação do ML, não se afirma exigência nenhuma.
 */
export async function recorteDaCategoria(
  categorias: readonly string[]
): Promise<RecorteDaCategoria> {
  const unicas = [...new Set(categorias.filter(Boolean))];
  const foraDaFicha: Record<string, string[]> = {};
  const obrigatorios: Record<string, { id: string; nome: string }[]> = {};
  await Promise.all(
    unicas.map(async (categoria) => {
      foraDaFicha[categoria] = [];
      obrigatorios[categoria] = [];
      try {
        const r = await fetch(`${API}/categories/${encodeURIComponent(categoria)}/attributes`);
        if (!r.ok) return;
        const lista = (await r.json()) as {
          id?: string;
          name?: string;
          tags?: Record<string, unknown>;
        }[];
        if (!Array.isArray(lista)) return;
        foraDaFicha[categoria] = lista
          .filter((a) => a.tags && ("hidden" in a.tags || "variation_attribute" in a.tags))
          .map((a) => a.id ?? "")
          .filter(Boolean);
        obrigatorios[categoria] = lista
          .filter((a) => a.tags && "required" in a.tags && a.id)
          .map((a) => ({ id: a.id as string, nome: (a.name ?? a.id) as string }));
      } catch {
        // Rede/ML fora: nada escondido, nada exigido.
      }
    })
  );
  return { foraDaFicha, obrigatorios };
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

/**
 * Quais destes MLBs o Mercado Livre CANCELOU por infração.
 *
 * ===========================================================================
 * POR QUE ISTO EXISTE
 * ===========================================================================
 *
 * 31/07/2026: o ML cancelou 6 anúncios da Chinelaria por "infração de
 * propriedade intelectual". Ela descobriu abrindo o painel; o Zion não sabia.
 *
 * E em 03/08 eu quase mandei republicar um deles — republicar o que foi
 * cancelado por infração é REINCIDÊNCIA, e a política do ML fala em suspensão
 * parcial, temporária ou permanente da conta.
 *
 * A trava não existe porque o Zion causou o problema; ele não causou. Existe
 * porque o Zion é a ferramenta que republica, e ferramenta que repete infração
 * sem avisar é pior que ferramenta nenhuma.
 *
 * ===========================================================================
 * POR QUE `sub_status` E NÃO UM ENDPOINT DE INFRAÇÕES
 * ===========================================================================
 *
 * O ML tem telas de infração no painel, e eu NÃO tenho a rota delas verificada.
 * Chutar endpoint foi o que me custou uma tarde em 02/08, quando pedi 31 campos
 * ao multiget sem confirmar.
 *
 * `sub_status: forbidden` é o sinal PROVADO: foi exatamente por ele que os 6
 * apareceram na medição, antes de qualquer um saber que existiam.
 *
 * FALHA FECHADA, ao contrário do resto do arquivo: se a consulta falhar, quem
 * chama decide — e no caso da publicação, decide não publicar. Um item a menos
 * publicado é reversível; uma reincidência de propriedade intelectual não.
 */
export async function mlbsComInfracao(
  accessToken: string,
  mlbs: readonly string[]
): Promise<string[]> {
  const ids = [...new Set(mlbs.map((m) => (m ?? "").trim()).filter(Boolean))];
  if (ids.length === 0) return [];
  const headers = { Authorization: `Bearer ${accessToken}` };
  const bloqueados: string[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20).join(",");
    const r = await fetch(`${API}/items?ids=${lote}&attributes=id,sub_status`, { headers });
    if (!r.ok) throw new Error(`Não consegui conferir infrações no ML: ${await extrairErro(r)}`);
    const arr = (await r.json()) as { code?: number; body?: { id?: string; sub_status?: string[] } }[];
    for (const x of arr) {
      if (x.code !== 200 || !x.body?.id) continue;
      if ((x.body.sub_status ?? []).includes("forbidden")) bloqueados.push(x.body.id);
    }
  }
  return bloqueados;
}

/**
 * A FAMÍLIA DE CADA ITEM, PERGUNTADA AO ML NA HORA.
 *
 * ===========================================================================
 * POR QUE PERGUNTAR EM VEZ DE GUARDAR
 * ===========================================================================
 *
 * O vínculo de família chega na importação e não é guardado: conferido em
 * 24/08/2026, nem `anuncios_gerados` nem `produtos` têm coluna de família, e
 * o jsonb `anuncio` só carrega o conteúdo gerado. Por isso o Copilot vinha
 * respondendo "não sei se estão agrupados" — e estava certo sobre o que sabia.
 *
 * Guardar na importação resolveria o custo, ao preço de responder com o
 * retrato do dia da última importação. A pergunta "estão agrupados?" é sobre
 * AGORA: quem acabou de agrupar no painel do ML quer ver agrupado. Dezesseis
 * numerações cabem em UMA chamada (o multiget vai de 20 em 20), então o preço
 * de estar certo é baixo o bastante para valer sempre.
 *
 * ===========================================================================
 * O QUE ELA DEVOLVE, E O QUE ELA NUNCA DEVOLVE
 * ===========================================================================
 *
 * Devolve o que LEU, e a lista do que não conseguiu ler. Não devolve
 * "soltos" para um item que o ML não entregou: item não lido é desconhecido,
 * e tratar desconhecido como resposta é como o Zion já disse a uma lojista
 * que a loja estava em dia sem ter olhado. Quem decide a situação é
 * `familiaNoMarketplace.ts`, que recebe as duas listas separadas.
 */
export interface FamiliaDoItem {
  mlb: string;
  /** O nome que o ML compartilha entre os itens da mesma família. */
  familyName: string;
  /** `user_product_id` — sozinho não agrupa; repetido em 2+ itens, agrupa. */
  userProductId: string;
  /** `family_id`. Chega como número às vezes — ver o incidente de 02/08. */
  familyId: string;
}

export interface LeituraDeFamilias {
  lidos: FamiliaDoItem[];
  /** Ids que o ML não devolveu. Não são "soltos": são desconhecidos. */
  naoLidos: string[];
}

export async function familiasDosItens(
  accessToken: string,
  mlbs: readonly string[]
): Promise<LeituraDeFamilias> {
  const ids = [...new Set(mlbs.map((m) => (m ?? "").trim()).filter(Boolean))];
  if (ids.length === 0) return { lidos: [], naoLidos: [] };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const lidos: FamiliaDoItem[] = [];
  const naoLidos: string[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20);
    const vieram = new Set<string>();
    try {
      const r = await fetch(
        `${API}/items?ids=${lote.join(",")}&attributes=id,family_name,user_product_id,family_id`,
        { headers }
      );
      if (r.ok) {
        const arr = (await r.json()) as { code?: number; body?: ItemRaw }[];
        for (const x of arr) {
          if (x.code !== 200 || !x.body?.id) continue;
          vieram.add(x.body.id);
          lidos.push({
            mlb: x.body.id,
            familyName: (x.body.family_name ?? "").trim(),
            userProductId: (x.body.user_product_id ?? "").toString().trim(),
            // `texto()` porque `family_id` já chegou como NÚMERO e derrubou a
            // importação inteira em 02/08/2026 com ".trim is not a function".
            familyId: texto(x.body.family_id),
          });
        }
      }
    } catch {
      // Rede caiu, ML fora, JSON quebrado: o lote inteiro vira desconhecido.
      // NÃO lança — quem pergunta sobre família continua tendo resposta sobre
      // a grade, e a parte que faltou é dita por extenso.
    }
    for (const id of lote) if (!vieram.has(id)) naoLidos.push(id);
  }
  return { lidos, naoLidos };
}
// ---- Fotos: ler a maior, subir a nova, trocar a capa ------------------------

/**
 * As variações de UMA foto — e o tamanho do ORIGINAL, que pode ser maior.
 *
 * `max_size` é o que o ML diz ser o original; `variations[]` é o que ele serve.
 * Os dois podem divergir, e a diferença muda o remédio: se o original tem 1200
 * e só há variação de 800, a foto boa existe e não está sendo entregue — o
 * conserto é reenviar, não refotografar.
 *
 * Ler só as variações faria recusar foto que TEM pixel.
 */
export async function variacoesDaFoto(
  accessToken: string,
  fotoId: string
): Promise<{
  variations: { size?: string; url?: string; secure_url?: string }[];
  maxSize: string;
}> {
  const r = await fetch(`${API}/pictures/${encodeURIComponent(fotoId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`ML recusou ler a foto ${fotoId}: ${await extrairErro(r)}`);
  const j = (await r.json()) as {
    variations?: { size?: string; url?: string; secure_url?: string }[];
    max_size?: string;
  };
  return { variations: j.variations ?? [], maxSize: (j.max_size ?? "").trim() };
}

/**
 * Sobe uma imagem e devolve o id que o ML deu a ela.
 *
 * A foto entra no acervo do vendedor; ela ainda NÃO está em anúncio nenhum.
 * Quem coloca no anúncio é `definirFotosDoItem`, e a separação é deliberada:
 * subir é reversível (uma foto solta não incomoda ninguém), trocar a capa é
 * que muda o que a compradora vê.
 */
export async function subirFoto(
  accessToken: string,
  imagem: Buffer,
  nome = "capa.jpg"
): Promise<string> {
  const forma = new FormData();
  forma.append("file", new Blob([new Uint8Array(imagem)], { type: "image/jpeg" }), nome);
  const r = await fetch(`${API}/pictures/items/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: forma,
  });
  if (!r.ok) throw new Error(`ML recusou a foto: ${await extrairErro(r)}`);
  const j = (await r.json()) as { id?: string };
  if (!j.id) throw new Error("O ML aceitou a foto e não devolveu o id dela.");
  return j.id;
}

/**
 * Define a lista de fotos do anúncio. A PRIMEIRA é a capa.
 *
 * Quem chama monta a lista inteira, e monta com as antigas dentro: o ML
 * SUBSTITUI o conjunto, então mandar só a nova apagaria as outras do anúncio.
 * Aqui não se decide o que preservar — decidir isso longe de quem tem o
 * contexto é como se perde foto.
 */
export async function definirFotosDoItem(
  accessToken: string,
  itemId: string,
  fotoIds: readonly string[]
): Promise<{ id: string; quantasFotos: number }> {
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pictures: fotoIds.map((id) => ({ id })) }),
  });
  if (!r.ok) throw new Error(`ML recusou trocar as fotos de ${itemId}: ${await extrairErro(r)}`);
  const j = (await r.json()) as { id: string; pictures?: unknown[] };
  return { id: j.id, quantasFotos: (j.pictures ?? []).length };
}

// ---- Escrita de TEXTO no anúncio que já está no ar ------------------------
//
// ===========================================================================
// A LACUNA QUE ESTAS TRÊS FUNÇÕES FECHAM
// ===========================================================================
//
// Até 19/08/2026 o cliente do ML tinha TRÊS escritas em anúncio existente:
// encerrar, pausar/reativar e fotos. Nenhuma tocava título, descrição ou ficha.
//
// O efeito, medido: o chat oferecia "melhorar o título", rodava o agente da
// Zion, a lojista confirmava — e o anúncio no ar continuava idêntico. A
// mensagem chegou a dizer isso em voz alta ("o anúncio que já está no ar não
// muda com isso"), que é honesto e não resolve: 480 anúncios ativos, e a
// otimização era ensaio.
//
// O texto sempre existiu — quem o escreve é o Opus 5 na esteira. Faltava a
// entrega.

/**
 * TROCA O TÍTULO de um anúncio no ar.
 *
 * O ML recusa em dois casos que valem ser distinguidos na mensagem, porque o
 * remédio é diferente: anúncio de CATÁLOGO não tem título próprio (o título é
 * do catálogo, e mudar exige sair dele), e anúncio COM VENDAS tem o título
 * congelado — quem comprou comprou aquilo.
 */
export async function definirTituloDoItem(
  accessToken: string,
  itemId: string,
  titulo: string
): Promise<{ id: string; titulo: string }> {
  const limpo = titulo.trim();
  if (!limpo) throw new Error("Título vazio: não mando isso ao Mercado Livre.");
  // 60 é o teto do ML. Cortar aqui em silêncio publicaria um título truncado no
  // meio de uma palavra — recusar devolve a decisão a quem escreveu.
  if (limpo.length > 60) {
    throw new Error(
      `O título tem ${limpo.length} caracteres e o Mercado Livre aceita 60. Encurte antes.`
    );
  }
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: limpo }),
  });
  if (!r.ok) throw new Error(`ML recusou trocar o título de ${itemId}: ${await extrairErro(r)}`);
  const j = (await r.json()) as { id: string; title?: string };
  // Devolvemos o título que o ML CONFIRMOU, não o que mandamos. Em 03/08/2026
  // alguém deu uma capa como trocada com base no 200 e ela era a antiga.
  return { id: j.id, titulo: j.title ?? "" };
}

/**
 * TROCA A DESCRIÇÃO — e é um ENDPOINT SEPARADO, não um campo do item.
 *
 * `PUT /items/{id}` com `description` é ignorado em silêncio: a descrição mora
 * em `/items/{id}/description`. Mandar pelo caminho errado devolveria 200 com
 * o texto antigo no ar — o formato de falha que este repositório mais persegue.
 *
 * `plain_text` e não `text`: `text` é o campo HTML legado, que o ML desativou
 * para categorias novas.
 */
export async function definirDescricaoDoItem(
  accessToken: string,
  itemId: string,
  descricao: string
): Promise<{ ok: true; tamanho: number }> {
  const limpo = descricao.trim();
  if (!limpo) throw new Error("Descrição vazia: não mando isso ao Mercado Livre.");
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}/description`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ plain_text: limpo }),
  });
  if (!r.ok) throw new Error(`ML recusou trocar a descrição de ${itemId}: ${await extrairErro(r)}`);
  return { ok: true, tamanho: limpo.length };
}

/**
 * PREENCHE ATRIBUTOS da ficha — e ACRESCENTA, nunca substitui o conjunto.
 *
 * Diferença que custou caro em `pictures`: lá o ML SUBSTITUI a lista inteira, e
 * mandar uma lista parcial apagou fotos. Em `attributes` ele faz merge por
 * `id` — os que não vão continuam lá. Mas a assimetria é fácil de esquecer, e
 * por isso está escrita aqui.
 *
 * Atributo com `value_id` DEVE ir com `value_id`: mandar só `value_name` num
 * atributo de lista faz o ML criar um valor livre que não casa com o filtro de
 * busca — o comprador que filtra por "Preto" não acha o anúncio.
 */
export async function definirAtributosDoItem(
  accessToken: string,
  itemId: string,
  atributos: readonly { id: string; value_id?: string | null; value_name?: string | null }[]
): Promise<{ id: string; quantosVieram: number }> {
  const uteis = atributos.filter((a) => a.id && (a.value_id || a.value_name));
  if (uteis.length === 0) throw new Error("Nenhum atributo preenchido para enviar.");
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      attributes: uteis.map((a) =>
        a.value_id ? { id: a.id, value_id: a.value_id } : { id: a.id, value_name: a.value_name }
      ),
    }),
  });
  if (!r.ok) throw new Error(`ML recusou a ficha de ${itemId}: ${await extrairErro(r)}`);
  const j = (await r.json()) as { id: string; attributes?: unknown[] };
  return { id: j.id, quantosVieram: (j.attributes ?? []).length };
}

/**
 * TROCA O PREÇO de um anúncio no ar.
 *
 * ===========================================================================
 * POR QUE ESTA FUNÇÃO NASCEU, E O QUE ELA RECUSA
 * ===========================================================================
 *
 * Em 20/08/2026 a lojista pausou 15 anúncios da Actvitta e escolheu manter o
 * preço de R$ 244,90. Sobraram dois anúncios do tamanho 39 a R$ 169,32 — não
 * porque eram melhores, mas porque eu só tinha olhado duplicidade e eles eram
 * únicos. O 39 ficaria R$ 75 mais barato que o 38 na mesma página.
 *
 * Eu disse a ela "a rota de preço existe". Não existia: o cliente do ML tinha
 * escrita de foto, de estado, e — desde hoje de manhã — de texto. Preço não.
 *
 * A TRAVA DO FATOR. O ML aceita qualquer preço, inclusive um que multiplique o
 * atual por 100 num erro de vírgula — e um anúncio a R$ 24.490 não é recusado,
 * é só nunca vendido. `fatorMaximo` recusa a troca ANTES de sair daqui.
 *
 * Não é paranoia: esta base já gravou R$ 30.277.872,00 como custo por uma
 * coluna ambígua. Lá o estrago ficou no nosso banco; aqui ficaria na vitrine.
 */
export async function definirPrecoDoItem(
  accessToken: string,
  itemId: string,
  preco: number,
  opcoes: { precoAtual: number; fatorMaximo?: number } = { precoAtual: 0 }
): Promise<{ id: string; preco: number }> {
  if (!(preco > 0)) throw new Error("Preço tem de ser maior que zero.");
  const fator = opcoes.fatorMaximo ?? 3;
  const atual = opcoes.precoAtual;
  if (atual > 0 && (preco > atual * fator || preco < atual / fator)) {
    throw new Error(
      `Recusei trocar o preço de ${itemId}: de R$ ${atual.toFixed(2)} para ` +
        `R$ ${preco.toFixed(2)} é mais de ${fator}x de diferença. Se for mesmo isso, ` +
        `faça em dois passos ou confirme no painel do Mercado Livre.`
    );
  }
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ price: preco }),
  });
  if (!r.ok) throw new Error(`ML recusou trocar o preço de ${itemId}: ${await extrairErro(r)}`);
  const j = (await r.json()) as { id: string; price?: number };
  // O preço que o ML CONFIRMOU, não o que mandamos — a regra de 03/08/2026.
  return { id: j.id, preco: Number(j.price ?? 0) };
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
  /**
   * Por que o anúncio está no estado em que está — a lista do ML.
   *
   * `under_review` sozinho não diz nada acionável. `sub_status` traz o motivo:
   * `pending_documentation`, `picture_download_pending`, `waiting_for_patch`,
   * `suspended`... Medido em 2026-08-01: 155 dos 781 anúncios da conta estavam
   * `under_review`, com 16 produtos INTEIROS fora do ar, e não havia como
   * saber por quê — porque o multiget não pedia este campo.
   *
   * Vazio quando o ML não informou. Nunca preenchido por nós.
   */
  subStatus: string[];
  permalink: string;
  sku: string; // seller_custom_field / SELLER_SKU
  marca: string;
  modelo: string;
  fotos: string[];
  /**
   * O tamanho REAL da foto de capa, na palavra do ML (`max_size`, ex.
   * "1200x1200"). Vazio quando o ML não informou.
   *
   * O ML tira exposição de anúncio cuja capa não cumpre o padrão dele, e o
   * painel da lojista mostrava "A foto de capa não cumpre os requisitos" em
   * dezenas de anúncios sem dizer o tamanho. Este campo é o único jeito de
   * saber sem adivinhar: a URL guardada aponta para uma VARIANTE (500px), e o
   * sufixo não indica qual é a maior.
   */
  fotoCapaMaxSize: string;
  /** A avaliação que o ML faz da foto de capa. Vazio quando não informou. */
  fotoCapaQualidade?: string;
  /**
   * A NOTA do ML para o anúncio (0..1). `null` = não informou.
   *
   * É o número que decide exposição. Passamos duas horas em 02/08/2026
   * tentando deduzir por tamanho de foto o que o ML entrega pronto.
   */
  saude?: number | null;
  /** O anúncio está atrelado a um produto do catálogo do ML? */
  doCatalogo?: boolean | null;
  catalogoProdutoId?: string;
  /** Quanto este anúncio VENDEU. O catálogo do Zion não tinha nenhum dado de venda. */
  vendidos?: number | null;
  quantidadeInicial?: number | null;
  /** Quando o anúncio foi criado e alterado — testa a hipótese da edição em massa. */
  criadoEmML?: string;
  atualizadoEmML?: string;
  /** `gold_special`, `gold_pro`… muda a comissão, e a precificação não sabia. */
  tipoDeAnuncio?: string;
  /** A estrutura de família. Se lida antes, o MLB órfão do Papete teria se identificado. */
  itemPaiId?: string;
  familiaIdDoML?: string;
  /** SE existe descrição. O TEXTO vem de `/items/{id}/description` — outra rota. */
  temDescricao?: boolean;
  garantia?: string;
  condicao?: string;
  videoId?: string;
  /** As tags do item no ML (`good_quality_picture`, `poor_quality_thumbnail`…). */
  tagsDoML?: string[];
  precoBase?: number | null;
  precoOriginal?: number | null;
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
  // O ML DIZ por que o anúncio não está no ar — `under_review` sozinho não
  // explica nada, e `sub_status` traz o motivo ("pending_documentation",
  // "picture_download_pending", "waiting_for_patch"...). Estava na API o tempo
  // todo; nós é que não pedíamos o campo.
  sub_status?: string[];
  /** A nota de qualidade que o ML dá ao anúncio (0..1). É ela que decide exposição. */
  health?: number | null;
  catalog_listing?: boolean | null;
  catalog_product_id?: string | null;
  sold_quantity?: number | null;
  initial_quantity?: number | null;
  date_created?: string | null;
  last_updated?: string | null;
  listing_type_id?: string | null;
  parent_item_id?: string | null;
  /** NÚMERO na resposta do ML, apesar do nome. Foi o que quebrou o mapeador. */
  family_id?: string | number | null;
  /** Lista de IDs, NÃO o texto — a descrição vem de /items/{id}/description. */
  descriptions?: { id?: string }[] | null;
  warranty?: string | null;
  condition?: string | null;
  video_id?: string | null;
  tags?: string[] | null;
  base_price?: number | null;
  original_price?: number | null;
  permalink?: string;
  seller_custom_field?: string;
  family_name?: string | null;
  user_product_id?: string | null;
  // `name` é o rótulo já traduzido pelo ML ("Material da sola"). Ele sempre
  // veio na resposta; só nunca foi declarado aqui, porque nada o lia.
  attributes?: { id?: string; name?: string; value_name?: string | null }[];
  shipping?: { dimensions?: string | null; free_shipping?: boolean; logistic_type?: string };
  // `size` e `max_size` vêm do ML em toda resposta e nunca foram lidos.
  // Sem eles não dá para saber o tamanho REAL da foto — e adivinhar pelo
  // sufixo da URL não funciona: medido em 02/08/2026, `-F` é 1200x1200 numa
  // imagem e 492x245 em outra, enquanto `-B` é a maior nessa segunda.
  pictures?: {
    url?: string;
    secure_url?: string;
    size?: string;
    max_size?: string;
    /** A avaliação que o ML faz da própria foto. Estava dentro de `pictures`
     *  desde sempre, num campo que já pedíamos e líamos pela metade. */
    quality?: string;
  }[];
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
 * ⚠️ A FONTE (1) NUNCA EXECUTOU EM PRODUÇÃO. Descoberto em 24/08/2026: o
 * multiget filtra por campo e `shipping` NÃO está em `CAMPOS_PEDIDOS_AO_ML`,
 * então o objeto nunca chega. Todo peso que a importação conseguiu até hoje
 * veio da fonte (2). Produto cujas medidas só existem em `shipping.dimensions`
 * entra zerado — e zero aqui vira `envio: "ausente"` na precificação, ou seja,
 * margem sem frete.
 *
 * Acrescentar "shipping" à lista é provavelmente a correção, e ela NÃO foi
 * feita porque o mesmo arquivo já ensinou o preço de chutar: se o ML recusar o
 * campo no filtro, o pedido inteiro degrada para `CAMPOS_MINIMOS_AO_ML` e a
 * importação perde de uma vez health, sold_quantity e listing_type_id. O
 * caminho é `scripts/medicoes/camposDoMercadoLivre.ts` contra a conta real —
 * e `camposDoMercadoLivre.test.ts` segura o achado até lá.
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
    // Fiel: a lista do ML, sem tradução e sem preencher o que não veio.
    subStatus: (it.sub_status ?? []).map((x) => (x ?? "").trim()).filter(Boolean),
    permalink: it.permalink ?? "",
    sku: (it.seller_custom_field || attr(it.attributes, "SELLER_SKU") || "").trim(),
    marca: attr(it.attributes, "BRAND"),
    modelo: attr(it.attributes, "MODEL"),
    fotos: (it.pictures ?? []).map((p) => p.secure_url || p.url || "").filter(Boolean),
    // A capa é a primeira foto — é ela que o ML avalia.
    fotoCapaMaxSize: texto((it.pictures ?? [])[0]?.max_size),
    fotoCapaQualidade: texto((it.pictures ?? [])[0]?.quality),
    // FIEL: número vira número, ausência vira `null` — e `null` significa "o ML
    // não disse", nunca zero. Uma saúde 0 e uma saúde desconhecida são coisas
    // diferentes, e confundi-las seria o defeito do dia inteiro outra vez.
    saude: typeof it.health === "number" ? it.health : null,
    doCatalogo: typeof it.catalog_listing === "boolean" ? it.catalog_listing : null,
    catalogoProdutoId: texto(it.catalog_product_id),
    vendidos: typeof it.sold_quantity === "number" ? it.sold_quantity : null,
    quantidadeInicial: typeof it.initial_quantity === "number" ? it.initial_quantity : null,
    criadoEmML: texto(it.date_created),
    atualizadoEmML: texto(it.last_updated),
    tipoDeAnuncio: texto(it.listing_type_id),
    itemPaiId: texto(it.parent_item_id),
    familiaIdDoML: texto(it.family_id),
    // `descriptions` é uma lista de IDs, NÃO o texto. E `undefined` NÃO é
    // "não tem descrição": é "não perguntamos". Observado em 02/08/2026 — o ML
    // recusou a lista de 31 campos, a leitura caiu para a lista mínima (que não
    // pede `descriptions`), e a tela afirmou "781 sem descrição" sobre um campo
    // que ninguém tinha lido. Ausência virando afirmação, no meu próprio código.
    //
    // O MESMO DEFEITO VOLTOU EM 24/08/2026, um nível abaixo. A lição de 02/08
    // tratou `null`, e a lista vazia passou: medido na conta real, o multiget
    // devolveu `descriptions: []` para 649 de 649 anúncios — cem por cento —
    // numa loja que vende desde abril. O mapeador transformava isso em
    // `false`, e a coluna gravou "não tem descrição" para o catálogo inteiro.
    //
    // Lista VAZIA não prova ausência: ela é indistinguível de "este endpoint
    // não popula o campo". O texto da descrição mora em `/items/{id}/description`,
    // uma rota que este arquivo não chama. Então só o caso NÃO VAZIO afirma
    // alguma coisa — e o que ele afirma é presença, nunca ausência.
    //
    // A assimetria de custo decide o empate: dizer "sem descrição" de um
    // anúncio que tem manda a lojista reescrever 649 descrições que já
    // existem. Dizer "não sei" só deixa de responder.
    temDescricao:
      it.descriptions != null && it.descriptions.length > 0 ? true : undefined,
    garantia: texto(it.warranty),
    condicao: texto(it.condition),
    videoId: texto(it.video_id),
    tagsDoML: (it.tags ?? []).map(texto).filter(Boolean),
    precoBase: typeof it.base_price === "number" ? it.base_price : null,
    precoOriginal: typeof it.original_price === "number" ? it.original_price : null,
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
 * Os campos que o multiget pede ao ML — e é uma LISTA BRANCA.
 *
 * O ML devolve SÓ o que está aqui. Campo fora desta string não chega nem para
 * ser ignorado: ele não existe do ponto de vista do Zion, e nenhuma leitura de
 * código revela o que está faltando.
 *
 * Foi assim que `sub_status` ficou invisível — o ML dizia por que o anúncio
 * estava fora do ar, e a pergunta nunca era feita.
 *
 * Exportada para `/api/ml/diagnostico-item` comparar esta lista com o que o ML
 * devolve quando pedimos o item INTEIRO. Fonte única: quem muda o pedido muda
 * o diagnóstico junto.
 *
 * `pictures` já traz `size` e `max_size` dentro; `attributes` traz a ficha
 * inteira. Pedir o campo não garante ler o conteúdo — os dois já foram lidos
 * pela metade.
 */
export const CAMPOS_PEDIDOS_AO_ML = [
  // ---- o que já era pedido ----
  "id","title","price","available_quantity","category_id","status","sub_status",
  "permalink","seller_custom_field","family_name","user_product_id",
  "attributes","pictures","variations",
  // ---- acrescentados em 02/08/2026, depois do inventário ----
  // O inventário mostrou 61 campos disponíveis e 14 pedidos. Estes sete grupos
  // entraram porque respondem perguntas ABERTAS, não porque estavam na lista:
  "health",                              // a nota do ML — é ela que decide exposição
  "catalog_listing","catalog_product_id",// "dados não correspondem ao produto original"
  "sold_quantity","initial_quantity",    // o que cada anúncio VENDEU
  "date_created","last_updated",         // testa a hipótese da edição em massa
  "listing_type_id",                     // clássico vs premium — muda a comissão
  "parent_item_id","family_id",          // a estrutura de família (o MLB órfão)
  "descriptions",                        // SE existe descrição (o texto é outra rota)
  "warranty","condition","video_id","tags",
  "base_price","original_price",
  // ---- acrescentado em 14/08/2026 ----
  // `shipping` — QUEM PAGA O FRETE. O mapeador lia `it.shipping?.free_shipping`
  // desde sempre, e este campo nunca esteve na lista: o ML nunca foi
  // perguntado. Resultado medido: 80 de 80 produtos com `vendedor_paga_frete`
  // nulo, e o botão respondendo "Nenhum anúncio informou o frete" — culpando a
  // fonte por omissão nossa, que é o pecado que o comentário de `falhaFoiNossa`
  // logo abaixo descreve. Sem frete não há preço mínimo, e sem preço mínimo a
  // precificação inteira fica parada.
  "shipping",
  // NÃO entraram, de propósito: geolocation, seller_address, coverage_areas,
  // channels, deal_ids, thumbnail, site_id, currency_id, accepts_mercadopago,
  // non_mercado_pago_payment_methods. São dado de conta e de plataforma, não de
  // produto. Pedir os 47 seria trocar um defeito por outro — ler sem saber por quê.
].join(",");

/**
 * A lista que funcionou o dia inteiro — o degrau seguro.
 *
 * Quando o pedido completo falha, a leitura NÃO cai para "sem filtro nenhum":
 * cai para esta. Sem filtro, o ML devolve o item inteiro, e 781 itens inteiros
 * é o caminho mais curto para estourar o `maxDuration` de novo — trocaríamos
 * uma falha por outra.
 *
 * Estes 14 campos trouxeram 781 anúncios com sucesso em 01 e 02/08/2026.
 */
export const CAMPOS_MINIMOS_AO_ML =
  "id,title,price,available_quantity,category_id,status,sub_status,permalink,seller_custom_field,family_name,user_product_id,attributes,pictures,variations";

/**
 * OS ANÚNCIOS QUE A BUSCA DO VENDEDOR NÃO DEVOLVE — lidos por ID.
 *
 * ===========================================================================
 * O BURACO QUE ISTO FECHA — MEDIDO EM 24/08/2026
 * ===========================================================================
 *
 * A conferida funciona assim: lista o que o `/users/{id}/items/search`
 * devolve, e atualiza o estado desses. Anúncio que sai do resultado da busca
 * NUNCA MAIS é atualizado — e a regra que protege isso ("ausência não é
 * encerramento") está certa, mas deixa o item congelado para sempre.
 *
 * Medido na conta real: 15 dos 792 anúncios. Onze deles importados em 08/07 e
 * nunca medidos — quatro conferidas passaram por cima sem vê-los. Os outros
 * quatro estão em `under_review`, três com `forbidden`, com o último estado
 * de 01/08 e 10/08: duas e três semanas parados.
 *
 * O multiget lê POR ID e não depende da busca. Então a pergunta que faltava
 * não é cara — são os mesmos 20 por chamada, e aqui são 15 no total.
 *
 * ===========================================================================
 * O QUE ELA DEVOLVE, E POR QUE `naoEncontrados` IMPORTA
 * ===========================================================================
 *
 * O ML pode responder que o item NÃO EXISTE. Isso é informação, e é diferente
 * de "não perguntei": um anúncio que o Mercado Livre não reconhece mais não
 * está em revisão nem pausado, e continuar contando-o como desconhecido
 * esconde a única coisa que se sabe sobre ele.
 *
 * Esta função NÃO decide o que fazer com isso — ela separa as duas listas e
 * deixa a decisão para quem chama, que é onde a política mora.
 */
export interface LeituraPorIds {
  anuncios: AnuncioML[];
  /** Ids que o ML recusou ou não devolveu. NÃO é "encerrado": é o que ele disse. */
  naoEncontrados: string[];
}

export async function lerItensPorIds(
  accessToken: string,
  mlbs: readonly string[]
): Promise<LeituraPorIds> {
  const ids = [...new Set(mlbs.map((m) => (m ?? "").trim()).filter(Boolean))];
  if (ids.length === 0) return { anuncios: [], naoEncontrados: [] };
  const headers = { Authorization: `Bearer ${accessToken}` };
  const anuncios: AnuncioML[] = [];
  const naoEncontrados: string[] = [];

  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20);
    const vieram = new Set<string>();
    for (const campos of [CAMPOS_PEDIDOS_AO_ML, CAMPOS_MINIMOS_AO_ML]) {
      try {
        const r = await fetch(`${API}/items?ids=${lote.join(",")}&attributes=${campos}`, { headers });
        if (!r.ok) continue;
        const arr = (await r.json()) as { code?: number; body?: ItemRaw }[];
        for (const x of arr) {
          if (x.code !== 200 || !x.body?.id || vieram.has(x.body.id)) continue;
          vieram.add(x.body.id);
          anuncios.push(mapearItem(x.body));
        }
        break; // a lista completa respondeu; não precisa do degrau
      } catch {
        // Rede ou JSON quebrado: tenta o degrau menor antes de desistir.
      }
    }
    for (const id of lote) if (!vieram.has(id)) naoEncontrados.push(id);
  }
  return { anuncios, naoEncontrados };
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
  /** O que o ML respondeu ao recusar um lote. Vazio quando nada foi recusado. */
  erroDoMultiget: string;
  /**
   * O ML recusou o filtro de campos e a leitura seguiu pedindo o item inteiro.
   *
   * Não é falha: os dados vêm iguais, só mais pesados. Mas precisa ser DITO —
   * silêncio aqui esconderia que a lista de campos está inválida, e ela ficaria
   * inválida para sempre.
   */
  filtroDeCamposRecusado: boolean;
  /**
   * A falha da leitura completa foi NOSSA (exceção) e não do ML (HTTP).
   *
   * Muda inteiramente onde procurar — e culpar a fonte por defeito próprio
   * manda quem lê para o lugar errado.
   */
  falhaDaLeituraFoiNossa: boolean;
  /** Itens que vieram com o objeto `shipping` no multiget. */
  itensComShipping?: number;
  /** Itens com `shipping.free_shipping` booleano — quem paga o frete. */
  itensComFreteInformado?: number;
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

  // 2) Multiget (20 por vez), com LOTES EM PARALELO.
  //
  // Era um laço `await` sequencial: 781 anúncios viravam 40 idas e voltas uma
  // depois da outra. Somado às 16 páginas da busca, isso já roçava os 60s de
  // `maxDuration` da rota — e em 02/08/2026, ao acrescentar 18 campos ao
  // pedido, cada resposta ficou maior e o limite estourou. A plataforma
  // devolveu HTML de 504 e a tela mostrou "Unexpected token '<'".
  //
  // O teto de 6 não é enfeite: sem ele, 40 requisições simultâneas ao ML são um
  // pico que a API pode recusar, e aí trocaríamos tempo esgotado por lote
  // perdido.
  const anuncios: AnuncioML[] = [];
  const lotes: string[] = [];
  for (let i = 0; i < ids.length; i += 20) lotes.push(ids.slice(i, i + 20).join(","));

  // O FILTRO DE CAMPOS PODE SER RECUSADO — e em 02/08/2026 foi.
  //
  // Ao pedir 31 campos em vez de 14, TODOS os 40 lotes voltaram vazios: 781
  // anúncios listados, zero trazidos. O `if (!r.ok) return []` engolia a
  // resposta do ML, então nem eu nem a lojista soubemos o motivo — terceira vez
  // no mesmo dia que um `catch` mudo transformou uma resposta em silêncio.
  //
  // Duas correções aqui, e a segunda importa mais:
  //
  //  1. O erro do ML é GUARDADO e sobe até a tela.
  //  2. Se o filtro é recusado, o lote é refeito SEM ele. O ML devolve o item
  //     inteiro, que é maior mas contém tudo que o filtro pediria — a
  //     importação passa a funcionar mesmo com um campo inválido na lista, em
  //     vez de zerar. Detectado uma vez, o filtro é abandonado para os lotes
  //     seguintes: não adianta insistir 39 vezes num pedido que já foi negado.
  let filtroRecusado = false;
  let erroDoMultiget = "";

  // NADA aqui pode falhar em silêncio. A tentativa anterior registrava só o
  // `!r.ok` — e em 02/08/2026 os 781 lotes falharam com `erroDoMultiget` VAZIO,
  // o que só é possível se a exceção veio de fora desse caminho: o `fetch`
  // lançando, ou o `.json()` de uma resposta 200 que não era JSON. O `catch`
  // externo devolvia `[]` e apagava o motivo. Quarta vez no mesmo dia que um
  // `catch` mudo transforma uma resposta em silêncio.
  function registrar(motivo: string) {
    if (!erroDoMultiget) erroDoMultiget = motivo;
  }

  /**
   * A falha foi DELE ou NOSSA?
   *
   * Um HTTP 4xx é o ML recusando. Uma exceção é o nosso código quebrando — e em
   * 02/08/2026 foi exatamente isso: `family_id` veio como número, `.trim()`
   * estourou dentro do mapeador, e a mensagem acusou o Mercado Livre de recusar
   * campos que ele nunca recusou. Culpar a fonte por defeito próprio é pior que
   * não explicar: manda procurar no lugar errado.
   */
  let falhaFoiNossa = false;
  /** Quantos itens vieram COM o objeto `shipping` — ver a medição em `buscarLote`. */
  let itensComShipping = 0;
  /** E quantos trouxeram `free_shipping` booleano dentro dele. */
  let itensComFreteInformado = 0;

  async function buscarLote(lote: string, campos: string): Promise<AnuncioML[] | "recusado"> {
    try {
      // `include_attributes=all` OU AS VARIAÇÕES VÊM SEM SKU.
      //
      // MEDIDO EM 18/08/2026. Sete anúncios de grade, 96 variações, e o SKU
      // chegava vazio em todas. A lojista mandou o print do painel dela:
      // `00895337` na variação 37 BR, preenchido, visível. O ML respondia 200,
      // com o array `variations` completo — e `variations[].attributes` VAZIO.
      //
      // Pedir `attributes` na lista de campos traz os atributos DO ITEM. Os da
      // VARIAÇÃO, onde moram SELLER_SKU e GTIN, só vêm com este parâmetro. Sem
      // ele o ML não recusa nem avisa: entrega o silêncio como se fosse a
      // resposta.
      //
      // Com o parâmetro: 96 de 96. Sem ele: 0 de 96.
      const r = await fetch(`${API}/items?ids=${lote}&attributes=${campos}&include_attributes=all`, {
        headers,
      });
      if (!r.ok) {
        registrar(`HTTP ${r.status} — ${await extrairErro(r)}`);
        return "recusado";
      }
      const arr = (await r.json()) as { code?: number; body?: ItemRaw }[];
      const corpos = arr.filter((x) => x.code === 200 && x.body?.id).map((x) => x.body!);
      // MEDIÇÃO NO PONTO DA DÚVIDA, 14/08/2026.
      //
      // `shipping` entrou na lista de campos hoje e o frete continuou chegando
      // nulo nos 780. Provamos com `GET /items/{id}` que `shipping.free_shipping`
      // EXISTE no item inteiro — o que não se sabia é se o MULTIGET, com o
      // filtro `attributes=`, devolve o objeto aninhado.
      //
      // Contar aqui responde isso de uma vez e para sempre, em vez de a próxima
      // pessoa refazer a mesma investigação. Se `comShipping` for 0 com
      // `shipping` na lista, o filtro do multiget é que não entrega, e o
      // caminho do frete precisa de outra fonte — não de mais um campo pedido.
      for (const b of corpos) {
        if (b.shipping && typeof b.shipping === "object") itensComShipping++;
        if (typeof b.shipping?.free_shipping === "boolean") itensComFreteInformado++;
      }
      return corpos.map((b) => mapearItem(b));
    } catch (e) {
      // `fetch failed` do undici traz o motivo real em `cause` — e é ele que
      // diz se foi tempo, conexão ou DNS. Sem isso, "lote com falha" de novo.
      const erro = e instanceof Error ? e.message : String(e);
      const causa = (e as { cause?: { code?: string; message?: string } })?.cause;
      const detalhe = causa?.code ?? causa?.message ?? "";
      falhaFoiNossa = true;
      registrar(`exceção no nosso código: ${erro}${detalhe ? ` (${detalhe})` : ""}`);
      return "recusado";
    }
  }

  const SIMULTANEOS = 6;
  for (let i = 0; i < lotes.length; i += SIMULTANEOS) {
    const rodada = await Promise.all(
      lotes.slice(i, i + SIMULTANEOS).map(async (lote) => {
        // Primeiro o pedido completo. Se ele falhar de QUALQUER forma, a
        // leitura degrada para a lista de 14 campos que funcionou o dia
        // inteiro — e não para "sem filtro", que devolveria 781 itens
        // inteiros e estouraria o tempo da rota.
        if (!filtroRecusado) {
          const completo = await buscarLote(lote, CAMPOS_PEDIDOS_AO_ML);
          if (completo !== "recusado") return completo;
          filtroRecusado = true; // os próximos já nascem com a lista mínima
        }
        const minimo = await buscarLote(lote, CAMPOS_MINIMOS_AO_ML);
        return minimo === "recusado" ? [] : minimo;
      })
    );
    for (const doLote of rodada) anuncios.push(...doLote);
  }

  return {
    anuncios,
    total,
    ids: ids.length,
    perdidos: ids.length - anuncios.length,
    parede,
    // O que o ML respondeu quando recusou. Vazio quando nada foi recusado.
    erroDoMultiget,
    // `true` quando a leitura completa falhou e seguiu com a lista mínima.
    filtroDeCamposRecusado: filtroRecusado,
    // A falha foi nossa (exceção) ou do ML (HTTP)? Muda onde procurar.
    falhaDaLeituraFoiNossa: falhaFoiNossa,
    // O FRETE, medido na fonte. Ver o comentário em `buscarLote`.
    itensComShipping,
    itensComFreteInformado,
  };
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

// ---------------------------------------------------------------------------
// O DIAGNÓSTICO de um anúncio — o que o ML sabe e nós não tínhamos
// ---------------------------------------------------------------------------

export interface RetratoDoItemML {
  id: string;
  status: string;
  subStatus: string[];
  preco: number | null;
  /** Unidades vendidas ao longo da vida do anúncio, na palavra do ML. */
  vendidos: number | null;
  estoque: number | null;
  /** A nota de saúde do ML (0..1). `null` quando ele não a informou. */
  saude: number | null;
  fotos: number;
  titulo: string;
  categoria: string | null;
  tipoAnuncio: string | null;
  permalink: string | null;
}

/**
 * `GET /items/{id}` com os campos que o diagnóstico lê. `health` é a nota que
 * decide exposição; `sold_quantity` é o que vendeu.
 */
export async function retratoDoItem(accessToken: string, itemId: string): Promise<RetratoDoItemML> {
  const campos = "id,status,sub_status,price,sold_quantity,available_quantity,health,pictures,title,category_id,listing_type_id,permalink";
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}?attributes=${campos}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`ML recusou ler o anúncio ${itemId}: ${await extrairErro(r)}`);
  const j = (await r.json()) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  return {
    id: String(j.id ?? itemId),
    status: String(j.status ?? ""),
    subStatus: Array.isArray(j.sub_status) ? j.sub_status.map(String) : [],
    preco: num(j.price),
    vendidos: num(j.sold_quantity),
    estoque: num(j.available_quantity),
    saude: num(j.health),
    fotos: Array.isArray(j.pictures) ? j.pictures.length : 0,
    titulo: String(j.title ?? ""),
    categoria: typeof j.category_id === "string" ? j.category_id : null,
    tipoAnuncio: typeof j.listing_type_id === "string" ? j.listing_type_id : null,
    permalink: typeof j.permalink === "string" ? j.permalink : null,
  };
}

/**
 * As VISITAS de um item nos últimos N dias — `GET /items/{id}/visits/time_window`.
 * `null` quando o ML não responde: visita desconhecida não é zero visita.
 */
export async function visitasDoItem(accessToken: string, itemId: string, dias: number): Promise<number | null> {
  const r = await fetch(
    `${API}/items/${encodeURIComponent(itemId)}/visits/time_window?last=${dias}&unit=day`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!r.ok) return null;
  const j = (await r.json()) as { total_visits?: unknown };
  return typeof j.total_visits === "number" ? j.total_visits : null;
}

/**
 * Troca o TÍTULO de um anúncio publicado — `PUT /items/{id}` com `{ title }`.
 *
 * ===========================================================================
 * A PRIMEIRA ESCRITA DE CONTEÚDO EM ANÚNCIO NO AR
 * ===========================================================================
 *
 * Até 24/08/2026 este cliente tinha seis escritas e NENHUMA delas mudava o
 * conteúdo de um item publicado: dava para criar, encerrar, pausar, reativar e
 * trocar as fotos, e mais nada. Corrigir um título errado exigia encerrar o
 * anúncio e republicar — perdendo histórico, reputação e a relevância que ele
 * tinha na busca.
 *
 * Título e não preço/estoque: é reversível (o título antigo volta), não move
 * dinheiro, e é o campo que decide se o anúncio APARECE na busca.
 *
 * ===========================================================================
 * ESTE CAMINHO NÃO FOI MEDIDO CONTRA A API REAL
 * ===========================================================================
 *
 * O formato vem da documentação, não de uma chamada observada — e este
 * repositório já pagou por essa diferença uma vez (a OpenAI passou um dia com
 * "chave aceita e caminho inexistente", ver `provedorImagem`).
 *
 * Por isso quem chama é obrigado a RELER o item e comparar (ver
 * `tituloNoAnuncio.ts`). Se o ML aceitar a requisição e não aplicar a mudança,
 * a releitura pega — e a resposta diz "enviei, mas não consegui confirmar" em
 * vez de "pronto". A verificação não é zelo: é o que torna seguro publicar um
 * caminho que ninguém observou ainda.
 *
 * O ML também RECUSA a troca em alguns casos (item com vendas, certas
 * categorias). A recusa dele sobe como está, porque ela diz o motivo e este
 * arquivo não sabe reescrevê-lo sem inventar.
 */
export async function atualizarTituloDoItem(
  accessToken: string,
  itemId: string,
  titulo: string
): Promise<{ id: string; titulo: string }> {
  const r = await fetch(`${API}/items/${encodeURIComponent(itemId)}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title: titulo }),
  });
  if (!r.ok) {
    throw new Error(`ML recusou trocar o título do anúncio ${itemId}: ${await extrairErro(r)}`);
  }
  const j = (await r.json()) as { id?: string; title?: string };
  // O título que o ML CONFIRMOU na resposta, não o que pedimos — pelo mesmo
  // motivo de `definirEstadoDoItem`: devolver o pedido faria a resposta
  // afirmar uma mudança que pode não ter acontecido.
  return { id: String(j.id ?? itemId), titulo: String(j.title ?? "") };
}
