// Início do OAuth do Mercado Livre — redireciona para a tela de autorização.
// SOMENTE SERVIDOR (usa ML_CLIENT_ID; o secret só é usado na troca do código).
//
// O botão "Conectar Mercado Livre" navega para cá; aqui montamos a URL de
// autorização e mandamos o vendedor para o ML fazer login e autorizar.

// Brasil usa "mercadoliVre.com.br" (com V). Os outros países do ML usam
// "mercadolibre" — só o BR é "Mercado Livre".
const AUTH_URL = "https://auth.mercadolivre.com.br/authorization";

function origem(request: Request): string {
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return `${proto}://${host}`;
}

export async function GET(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  if (!clientId) {
    return Response.json(
      { erro: "ML_CLIENT_ID não configurado no servidor." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const state = searchParams.get("clienteId") ?? "";
  const redirectUri = process.env.ML_REDIRECT_URI ?? `${origem(request)}/cliente/conectar-ml`;

  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  if (state) url.searchParams.set("state", state);

  return Response.redirect(url.toString(), 302);
}
