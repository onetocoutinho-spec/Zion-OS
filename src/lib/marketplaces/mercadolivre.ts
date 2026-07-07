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
