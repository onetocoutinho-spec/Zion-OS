// Pausa ou reativa um anúncio no Mercado Livre — SOMENTE SERVIDOR.
//
// ===========================================================================
// POR QUE ESTA ROTA É SEPARADA DE /api/ml/encerrar
// ===========================================================================
//
// `closed` é TERMINAL: o anúncio sai do ar, não volta, e leva junto o histórico
// de relevância. `paused` é REVERSÍVEL.
//
// São operações com consequências de ordens de grandeza diferentes, e juntá-las
// numa rota com um parâmetro `status` faria um erro de digitação destruir um
// anúncio. A rota que destrói continua sozinha, com o comentário dela.
//
// Esta aqui só aceita `paused` e `active`. Mandar `closed` por aqui é 400 —
// e é 400 de propósito, não por falta de suporte.
//
// Mesmo contrato de segurança de /api/ml/publicar: autorização server-side pelo
// cliente, refresh_token lido só no servidor (RLS) e o token rotacionado
// persistido ANTES de qualquer operação externa — se a operação falhar, a
// conexão do cliente continua íntegra.

import { definirEstadoDoItem } from "@/lib/marketplaces/mercadolivre";
import { lerCanalServidor, atualizarRefreshTokenServidor } from "@/modules/integration/infrastructure/canalServidor";
import { renovarTokenDaRota } from "@/modules/integration/infrastructure/renovacaoDaRota";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";

interface Corpo {
  clienteId?: string;
  itemId?: string;
  estado?: string;
  marketplace?: string;
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
  if (!corpo?.clienteId) {
    return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  }
  const itemId = (corpo.itemId ?? "").trim();
  if (!itemId) {
    return Response.json({ erro: "itemId ausente." }, { status: 400 });
  }

  // A lista é fechada e a mensagem diz por quê. `closed` recusado aqui não é
  // limitação: é a separação entre o que se desfaz e o que não se desfaz.
  const estado = (corpo.estado ?? "").trim();
  if (estado !== "paused" && estado !== "active") {
    return Response.json(
      {
        erro:
          estado === "closed"
            ? "Encerrar um anúncio é definitivo e não passa por aqui — use a ação de encerrar."
            : "Estado inválido: use 'paused' para tirar do ar ou 'active' para voltar.",
      },
      { status: 400 }
    );
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

    const renovacao = await renovarTokenDaRota({
      clientId,
      clientSecret,
      refreshToken: canal.refreshToken,
      marketplace: marketplace,
      oQueFalhou: "pausar ou reativar o anúncio",
    });
    if ("recusa" in renovacao) return renovacao.recusa;
    const tokens = renovacao.tokens;
    await atualizarRefreshTokenServidor(ctx.supabase, corpo.clienteId, tokens.refreshToken, marketplace);

    const resultado = await definirEstadoDoItem(tokens.accessToken, itemId, estado);
    // `status` é o que o ML CONFIRMOU, não o que pedimos: uma reativação pode
    // voltar como `under_review`, e é esse o estado que tem de ser gravado.
    return Response.json({ id: resultado.id, status: resultado.status });
  } catch (e) {
    // 422, NÃO 502 — a recusa do ML não é falha de gateway.
    //
    // MEDIDO EM 18/08/2026. Ao pausar `MLB7041100974` a tela recebeu
    // "502 Bad gateway" em HTML do Cloudflare. A rota estava viva (a validação
    // respondia 400 em 300ms) e o `catch` montava a mensagem CERTA — "ML
    // recusou pausar o anúncio X: <motivo>". Só que num 5xx o Cloudflare
    // descarta o corpo e serve a página dele.
    //
    // Ou seja: o motivo real da recusa era calculado e jogado fora na borda.
    // É o mesmo defeito que este repo persegue o dia inteiro — o dado existe,
    // o caminho não entrega, e sobra um erro genérico que manda procurar no
    // lugar errado.
    //
    // 422 é o código honesto: a requisição chegou, foi entendida, e a operação
    // foi recusada pelo marketplace. E atravessa a borda com o corpo intacto.
    return Response.json(
      { erro: e instanceof Error ? e.message : "Falha ao mudar o estado do anúncio." },
      { status: 422 }
    );
  }
}
