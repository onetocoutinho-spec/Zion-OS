// Vendas do Mercado Livre (dashboard de métricas) — SOMENTE SERVIDOR.
//
// Recebe o refresh_token do cliente, renova o access token (segredo do app só
// no env), busca os pedidos pagos e devolve o formato enxuto + o refresh_token
// rotacionado (o cliente persiste).

import { renovarToken, buscarPedidosML } from "@/lib/marketplaces/mercadolivre";

export const maxDuration = 60;

interface Corpo {
  refreshToken: string;
  sellerId?: string;
  desde?: string; // ISO
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
  if (!corpo?.refreshToken) {
    return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
  }

  try {
    const tokens = await renovarToken({
      clientId,
      clientSecret,
      refreshToken: corpo.refreshToken,
    });
    const sellerId = corpo.sellerId || tokens.userId;
    if (!sellerId) {
      return Response.json(
        { erro: "seller_id do Mercado Livre não encontrado.", refreshToken: tokens.refreshToken },
        { status: 422 }
      );
    }

    const pedidos = await buscarPedidosML(tokens.accessToken, sellerId, { desde: corpo.desde });

    return Response.json({
      pedidos,
      sellerId,
      refreshToken: tokens.refreshToken,
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao buscar vendas do ML." },
      { status: 502 }
    );
  }
}
