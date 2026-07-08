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

async function extrairErro(resposta: Response): Promise<string> {
  try {
    const j = (await resposta.json()) as {
      message?: string;
      error?: string;
      cause?: { message?: string }[];
    };
    const causas = (j.cause ?? []).map((c) => c.message).filter(Boolean).join("; ");
    return [j.message || j.error, causas].filter(Boolean).join(" — ") || `HTTP ${resposta.status}`;
  } catch {
    return `HTTP ${resposta.status}`;
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
  if (!resposta.ok) throw new Error(`Falha ao renovar token do ML: ${await extrairErro(resposta)}`);
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

export interface AnuncioML {
  mlb: string;
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
  attributes?: { id?: string; value_name?: string | null }[];
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

function mapearItem(it: ItemRaw): AnuncioML {
  const variacoes: VariacaoAnuncioML[] = (it.variations ?? []).map((v) => ({
    cor: attr(v.attribute_combinations, "COLOR"),
    tamanho: attr(v.attribute_combinations, "SIZE"),
    sku: (v.seller_custom_field || attr(v.attributes, "SELLER_SKU") || "").trim(),
    ean: attr(v.attributes, "GTIN"),
    preco: Number(v.price ?? it.price ?? 0),
    estoque: Number(v.available_quantity ?? 0),
  }));
  return {
    mlb: it.id ?? "",
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
    familyId: (it.user_product_id ?? "").toString().trim(),
    familyName: (it.family_name ?? "").trim(),
    cor: attr(it.attributes, "COLOR"),
    tamanho: attr(it.attributes, "SIZE"),
    ean: attr(it.attributes, "GTIN"),
  };
}

/** Lista os MLBs do vendedor e busca cada um (multiget de 20 em 20). */
export async function buscarAnunciosDoVendedor(
  accessToken: string,
  sellerId: string,
  opcoes: { max?: number } = {}
): Promise<AnuncioML[]> {
  const teto = opcoes.max ?? 500;
  const headers = { Authorization: `Bearer ${accessToken}` };

  // 1) Coleta os ids (paginado).
  const ids: string[] = [];
  let offset = 0;
  while (ids.length < teto) {
    const url = `${API}/users/${sellerId}/items/search?limit=50&offset=${offset}`;
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`Falha ao listar anúncios do ML: ${await extrairErro(r)}`);
    const d = (await r.json()) as { results?: string[]; paging?: { total?: number } };
    const results = d.results ?? [];
    if (results.length === 0) break;
    ids.push(...results);
    offset += 50;
    if (offset >= (d.paging?.total ?? 0)) break;
  }

  // 2) Multiget (20 por vez) com os campos que interessam.
  const anuncios: AnuncioML[] = [];
  const campos =
    "id,title,price,available_quantity,category_id,status,permalink,seller_custom_field,family_name,user_product_id,attributes,pictures,variations";
  for (let i = 0; i < ids.length; i += 20) {
    const lote = ids.slice(i, i + 20).join(",");
    const r = await fetch(`${API}/items?ids=${lote}&attributes=${campos}`, { headers });
    if (!r.ok) continue;
    const arr = (await r.json()) as { code?: number; body?: ItemRaw }[];
    for (const x of arr) {
      if (x.code === 200 && x.body?.id) anuncios.push(mapearItem(x.body));
    }
  }

  return anuncios;
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
  }
): Promise<GuiaTamanhos> {
  const siteId = dados.siteId ?? "MLB";
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
  if (!r.ok) throw new Error(`Falha ao criar a guia de tamanhos: ${await extrairErro(r)}`);
  const j = (await r.json()) as { id: string; rows?: { id?: string }[] };
  const gridId = j.id;
  const rowIdPorTamanho: Record<string, string> = {};
  dados.linhas.forEach((l, i) => {
    rowIdPorTamanho[String(l.tamanho)] = j.rows?.[i]?.id ?? `${gridId}:${i + 1}`;
  });
  return { gridId, rowIdPorTamanho };
}
