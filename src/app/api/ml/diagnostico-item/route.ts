// Diagnóstico de UM item do Mercado Livre — somente leitura.
//
// Existe para responder perguntas do tipo "de onde vem esse dado?" sem que
// alguém tenha que extrair o access_token do servidor para testar na mão.
//
// A pergunta que motivou a rota: a importação lê `price` de /items, e o ML
// documentou que vai DESCONTINUAR esse campo em favor de /items/{id}/prices.
// Se o campo já vier vazio, todo produto importado entra com preço zero — e a
// precificação inteira fica muda. Esta rota mostra os dois lados lado a lado.
//
// NÃO cria, NÃO altera e NÃO encerra nada. Segue o contrato de /api/ml/publicar:
// autorização server-side, refresh_token via RLS, token rotacionado persistido
// antes da operação externa.

import { renovarToken } from "@/lib/marketplaces/mercadolivre";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

const API = "https://api.mercadolibre.com";

/** "MLB-4598408351" e "MLB4598408351" são a mesma coisa; a API quer sem hífen. */
function normalizarItemId(bruto: string): string {
  return bruto.trim().toUpperCase().replace(/-/g, "");
}

export async function GET(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json({ erro: "Integração ML não configurada no servidor." }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const clienteId = (searchParams.get("clienteId") ?? "").trim();
  const itemId = normalizarItemId(searchParams.get("itemId") ?? "");
  if (!clienteId) return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  if (!itemId) return Response.json({ erro: "itemId ausente." }, { status: 400 });

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!ctx.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  try {
    const canal = await lerCanalServidor(ctx.supabase, clienteId, "Mercado Livre");
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }
    const tokens = await renovarToken({ clientId, clientSecret, refreshToken: canal.refreshToken });
    await atualizarRefreshTokenServidor(ctx.supabase, clienteId, tokens.refreshToken, "Mercado Livre");
    const auth = { Authorization: `Bearer ${tokens.accessToken}` };

    // Os dois lados da pergunta, em paralelo.
    const [itemResp, precosResp] = await Promise.all([
      fetch(`${API}/items/${itemId}`, { headers: auth }),
      fetch(`${API}/items/${itemId}/prices`, { headers: auth }),
    ]);

    const item = itemResp.ok ? ((await itemResp.json()) as Record<string, unknown>) : null;
    const precos = precosResp.ok ? ((await precosResp.json()) as Record<string, unknown>) : null;

    const variacoes = Array.isArray(item?.variations)
      ? (item!.variations as Record<string, unknown>[])
      : [];

    return Response.json({
      itemId,
      // O que a importação lê HOJE:
      deItems: {
        status: itemResp.status,
        price: item?.price ?? null,
        base_price: item?.base_price ?? null,
        original_price: item?.original_price ?? null,
        title: item?.title ?? null,
        category_id: item?.category_id ?? null,
        shipping_dimensions: (item?.shipping as { dimensions?: string })?.dimensions ?? null,
        variacoes: variacoes.length,
        precoDaPrimeiraVariacao: variacoes[0]?.price ?? null,
      },
      // O que o ML manda usar a partir de agora:
      dePrices: {
        status: precosResp.status,
        prices: precos?.prices ?? null,
      },
    });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao consultar o item no ML." },
      { status: 502 }
    );
  }
}
