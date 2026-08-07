// Encerra um anúncio no Mercado Livre (status "closed").
//
// Existe para sustentar a MIGRAÇÃO de anúncio: republicar é estratégia legítima
// do lojista (editar o título de um anúncio vivo reseta o histórico de
// relevância), mas manter dois anúncios ativos do mesmo produto, nas mesmas
// condições, infringe a política do ML e pode custar o anúncio ou a conta.
//
// "closed" é TERMINAL no Mercado Livre: o anúncio sai do ar e não volta. Por
// isso esta rota só é chamada a partir de uma decisão explícita de quem vende —
// nunca por inferência do sistema.
//
// Segue o mesmo contrato de segurança de /api/ml/publicar: autorização
// server-side pelo cliente, refresh_token lido só no servidor (RLS) e o token
// rotacionado persistido antes de qualquer operação externa.

import { encerrarItem } from "@/lib/marketplaces/mercadolivre";
import { lerCanalServidor, atualizarRefreshTokenServidor } from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

interface Corpo {
  clienteId?: string;
  itemId?: string;
  marketplace?: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      { erro: "Integração ML não configurada no servidor. Defina ML_CLIENT_ID e ML_CLIENT_SECRET no .env." },
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
  const itemId = (corpo.itemId ?? "").trim();
  if (!itemId) {
    return Response.json({ erro: "itemId ausente." }, { status: 400 });
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
      return Response.json(
        { erro: "Cliente não conectado ao Mercado Livre." },
        { status: 400 }
      );
    }

    const renovacao = await renovarTokenDaRota({
      clientId,
      clientSecret,
      refreshToken: canal.refreshToken,
      marketplace: marketplace,
      oQueFalhou: "encerrar o anúncio",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    // Persiste o refresh_token rotacionado ANTES da operação externa — se o
    // encerramento falhar, a conexão do cliente continua íntegra.
    await atualizarRefreshTokenServidor(ctx.supabase, corpo.clienteId, tokens.refreshToken, marketplace);

    const resultado = await encerrarItem(tokens.accessToken, itemId);
    return Response.json({ id: resultado.id, status: resultado.status });
  } catch (e) {
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao encerrar o anúncio." },
      { status: 502 }
    );
  }
}
