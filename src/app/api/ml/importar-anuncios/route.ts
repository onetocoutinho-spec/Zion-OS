// Importar anúncios já cadastrados na conta do ML — SOMENTE SERVIDOR.
//
// Renova o token do cliente, lista os itens do vendedor e devolve o conteúdo
// enxuto. O client mapeia para produtos/variações/anúncios e grava (RLS).

import { renovarToken, buscarAnunciosDoVendedor } from "@/lib/marketplaces/mercadolivre";

export const maxDuration = 60;

interface Corpo {
  refreshToken: string;
  sellerId?: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ erro: "Integração ML não configurada no servidor." }, { status: 503 });
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
    const tokens = await renovarToken({ clientId, clientSecret, refreshToken: corpo.refreshToken });
    const sellerId = corpo.sellerId || tokens.userId;
    if (!sellerId) {
      return Response.json(
        { erro: "seller_id não encontrado.", refreshToken: tokens.refreshToken },
        { status: 422 }
      );
    }
    const anuncios = await buscarAnunciosDoVendedor(tokens.accessToken, sellerId);
    return Response.json({ anuncios, sellerId, refreshToken: tokens.refreshToken });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao importar anúncios do ML." },
      { status: 502 }
    );
  }
}
