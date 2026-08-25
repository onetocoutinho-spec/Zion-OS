// O que o Mercado Livre REALMENTE cobra deste cliente.
//
// Duas perguntas que só o ML responde, e que antes eram tabela chutada no
// código:
//   1. a tarifa de venda da CATEGORIA exata do produto (/sites/MLB/listing_prices)
//   2. a reputação do vendedor, que escolhe a tabela de custo de envio (/users/me)
//
// Ambas exigem o access_token do cliente, que vive só no servidor — por isso
// esta rota existe. Segue o mesmo contrato de /api/ml/publicar: autorização
// server-side, refresh_token lido via RLS e token rotacionado persistido antes
// de qualquer operação externa.
//
// É SOMENTE LEITURA: não cria, não altera e não encerra nada no ML.

import {
  consultarTarifaDeVenda,
  consultarReputacao,
} from "@/lib/marketplaces/mercadolivre";
import {
  lerCanalServidor,
  atualizarRefreshTokenServidor,
  clienteDaCredencial,
} from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { respostaDeErro, mensagemParaONavegador } from "@/lib/http/respostaDeErro";

interface Corpo {
  clienteId?: string;
  marketplace?: string;
  /** Quando presente, consulta também a tarifa da categoria. */
  categoryId?: string;
  preco?: number;
  listingTypeId?: string;
  shippingMode?: string;
  logisticType?: string;
}

export async function POST(request: Request) {
  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return Response.json(
      { erro: "Integração ML não configurada no servidor." },
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
    const canal = await lerCanalServidor(clienteDaCredencial(), corpo.clienteId, marketplace);
    if (!canal?.refreshToken) {
      return Response.json({ erro: "Cliente não conectado ao Mercado Livre." }, { status: 400 });
    }

    const renovacao = await renovarTokenDaRota({
      clientId,
      clientSecret,
      refreshToken: canal.refreshToken,
      marketplace: marketplace,
      oQueFalhou: "calcular seus preços",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    await atualizarRefreshTokenServidor(clienteDaCredencial(), corpo.clienteId, tokens.refreshToken, marketplace);

    // A reputação vem sempre; a tarifa só quando há categoria e preço, porque
    // sem os dois o ML não tem o que calcular.
    const reputacao = await consultarReputacao(tokens.accessToken);

    let tarifa = null;
    const categoryId = (corpo.categoryId ?? "").trim();
    const preco = Number(corpo.preco);
    if (categoryId && Number.isFinite(preco) && preco > 0) {
      // Falhar a tarifa não pode derrubar a reputação: são duas respostas
      // independentes, e meia resposta certa vale mais que nenhuma.
      try {
        tarifa = await consultarTarifaDeVenda(tokens.accessToken, {
          categoryId,
          preco,
          listingTypeId: corpo.listingTypeId ?? "gold_pro",
          shippingMode: corpo.shippingMode,
          logisticType: corpo.logisticType,
        });
      } catch (e) {
        tarifa = null;
        return Response.json({
          reputacao,
          tarifa: null,
          aviso: mensagemParaONavegador(e, "Não foi possível consultar a tarifa."),
        });
      }
    }

    return Response.json({ reputacao, tarifa });
  } catch (e) {
    return respostaDeErro("ml/custos", e, "Falha ao consultar os custos no ML.", 502);
  }
}
