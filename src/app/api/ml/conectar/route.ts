// Troca do código do OAuth do Mercado Livre pelos tokens — SOMENTE SERVIDOR.
//
// Recebe o `code` que o ML devolveu no callback e troca por access/refresh
// token usando ML_CLIENT_ID + ML_CLIENT_SECRET (env, nunca expostos). Devolve
// o refresh_token + seller_id para o portal salvar no canal do cliente.

import { trocarCodigoPorToken } from "@/lib/marketplaces/mercadolivre";

export const maxDuration = 30;

interface Corpo {
  code: string;
  redirectUri: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      { erro: "Integração ML não configurada no servidor (ML_CLIENT_ID / ML_CLIENT_SECRET)." },
      { status: 503 }
    );
  }

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  if (!corpo?.code) {
    return Response.json({ erro: "Código de autorização ausente." }, { status: 400 });
  }

  const redirectUri = process.env.ML_REDIRECT_URI ?? corpo.redirectUri;
  if (!redirectUri) {
    return Response.json({ erro: "redirect_uri ausente." }, { status: 400 });
  }

  try {
    const tokens = await trocarCodigoPorToken({
      clientId,
      clientSecret,
      code: corpo.code,
      redirectUri,
    });
    return Response.json({
      refreshToken: tokens.refreshToken,
      sellerId: tokens.userId ?? null,
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao conectar com o Mercado Livre." },
      { status: 502 }
    );
  }
}
