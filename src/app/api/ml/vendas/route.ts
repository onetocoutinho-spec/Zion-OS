// Vendas do Mercado Livre (dashboard de métricas) — SOMENTE SERVIDOR.
//
// Recebe o `clienteId`. Autoriza no servidor, busca o refresh_token do canal
// (nunca vem do navegador — R3), renova o access token (segredo do app só no
// env), busca os pedidos pagos e devolve o formato enxuto. O refresh_token é
// rotacionado e persistido SÓ no servidor; nunca é devolvido ao navegador.

import { renovarToken, buscarPedidosML } from "@/lib/marketplaces/mercadolivre";
import { lerCanalServidor, atualizarRefreshTokenServidor } from "@/modules/integration/infrastructure/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

export const maxDuration = 60;

interface Corpo {
  clienteId: string;
  desde?: string; // ISO
  marketplace?: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      { erro: "Integração ML não configurada no servidor.", configurado: false },
      { status: 503 }
    );
  }

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  if (!corpo?.clienteId) {
    return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, corpo.clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const marketplace = corpo.marketplace ?? "Mercado Livre";

  try {
    const canal = await lerCanalServidor(ctx.supabase, corpo.clienteId, marketplace);
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }

    const tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
    await atualizarRefreshTokenServidor(ctx.supabase, corpo.clienteId, tokens.refreshToken, marketplace);

    const sellerId = canal.sellerId || tokens.userId;
    if (!sellerId) {
      return Response.json({ erro: "seller_id do Mercado Livre não encontrado." }, { status: 422 });
    }

    const pedidos = await buscarPedidosML(tokens.accessToken, sellerId, { desde: corpo.desde });
    return Response.json({ pedidos, sellerId });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao buscar vendas do ML." },
      { status: 502 }
    );
  }
}
