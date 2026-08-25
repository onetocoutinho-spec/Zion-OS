// Publicação no Mercado Livre (Fase 3) — SOMENTE SERVIDOR.
//
// Recebe o payload JÁ MONTADO pelo cliente (o builder é puro e sem segredo) +
// o `clienteId`. Autoriza no servidor e entrega a
// `publicarNoMercadoLivre`, que BUSCA o refresh_token do canal (nunca vem do
// navegador — R3), renova o access token com o segredo do APP ML (env),
// prediz a categoria se faltar, e publica em /items.
//
// Esta rota é um TRADUTOR: corpo → autorização → miolo → HTTP. O miolo saiu
// daqui em 2026-08-22 para a confirmação de uma proposta do Copilot publicar
// pelo mesmo caminho, com as mesmas guardas, sem um fetch do servidor para si
// mesmo. Ver `modules/integration/application/publicarNoMercadoLivre.ts`.
//
// Segurança: ML_CLIENT_ID / ML_CLIENT_SECRET vivem só no .env do servidor.
// O refresh_token do cliente é lido e rotacionado SÓ no servidor; nunca é
// enviado nem devolvido ao navegador.

import {
  publicarNoMercadoLivre,
  type PedidoDePublicacao,
} from "@/modules/integration/application/publicarNoMercadoLivre";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

export const maxDuration = 60;

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      {
        erro: "Integração ML não configurada no servidor. Defina ML_CLIENT_ID e ML_CLIENT_SECRET no .env.",
        configurado: false,
      },
      { status: 503 }
    );
  }

  let corpo: PedidoDePublicacao;
  try {
    corpo = (await request.json()) as PedidoDePublicacao;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (!corpo?.clienteId) {
    return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  }
  if (!corpo?.payload || typeof corpo.payload !== "object") {
    return Response.json({ erro: "Payload do anúncio ausente." }, { status: 400 });
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

  const r = await publicarNoMercadoLivre(corpo, { clientId, clientSecret });
  return Response.json(r.body, { status: r.status });
}
