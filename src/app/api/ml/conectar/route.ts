// Troca do código do OAuth do Mercado Livre pelos tokens — SOMENTE SERVIDOR.
//
// Recebe o `code` do callback + o `clienteId`. Autoriza no servidor (o usuário
// só conecta o PRÓPRIO cliente; a equipe conecta qualquer um), troca o código
// por tokens usando ML_CLIENT_ID + ML_CLIENT_SECRET (env, nunca expostos) e
// SALVA o refresh_token direto no canal (server-side, via RLS).
//
// ⚠️ O refresh_token NUNCA é devolvido ao navegador (R3).

import { trocarCodigoPorToken } from "@/lib/marketplaces/mercadolivre";
import { salvarRefreshTokenServidor } from "@/lib/marketplaces/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

export const maxDuration = 30;

interface Corpo {
  code: string;
  redirectUri: string;
  clienteId: string;
  marketplace?: string;
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
  if (!corpo?.clienteId) {
    return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  }

  // Autorização server-side: o usuário precisa poder operar este cliente.
  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, corpo.clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
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
    // Grava o refresh_token no canal, no servidor — o navegador nunca o vê.
    await salvarRefreshTokenServidor(
      ctx.supabase,
      corpo.clienteId,
      tokens.refreshToken,
      corpo.marketplace ?? "Mercado Livre",
      { sellerId: tokens.userId ?? null }
    );
    return Response.json({ ok: true, sellerId: tokens.userId ?? null });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao conectar com o Mercado Livre." },
      { status: 502 }
    );
  }
}
