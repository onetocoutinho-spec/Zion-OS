// Troca do código do OAuth do Mercado Livre pelos tokens — SOMENTE SERVIDOR.
//
// Recebe o `code` do callback + o `clienteId`. Autoriza no servidor (o usuário
// só conecta o PRÓPRIO cliente; a equipe conecta qualquer um), troca o código
// por tokens usando ML_CLIENT_ID + ML_CLIENT_SECRET (env, nunca expostos) e
// SALVA o refresh_token direto no canal (server-side, via RLS).
//
// ⚠️ O refresh_token NUNCA é devolvido ao navegador (R3).

import { trocarCodigoPorToken } from "@/lib/marketplaces/mercadolivre";
import { salvarRefreshTokenServidor, clienteDaCredencial } from "@/modules/integration/infrastructure/canalServidor";
import {
  exigirAcessoAoCliente,
  exigirAutenticado,
  respostaErroAutorizacao,
} from "@/lib/auth/serverAuthorization";
import { respostaDeErro, mensagemParaONavegador } from "@/lib/http/respostaDeErro";

export const maxDuration = 30;

interface Corpo {
  code: string;
  redirectUri: string;
  /**
   * O `state` que voltou do Mercado Livre.
   *
   * É um TICKET opaco (migração 055), não um `clienteId`. Quem diz de qual loja
   * se trata é a linha em `ml_conexoes_pendentes`, e ela só é encontrada por
   * quem criou o ticket. O navegador nunca afirma a loja — ele só devolve o
   * papelzinho que recebeu.
   */
  ticket: string;
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
  if (!corpo?.ticket) {
    return Response.json({ erro: "Ticket de conexão ausente." }, { status: 400 });
  }

  // ==========================================================================
  // A LOJA VEM DO TICKET, NUNCA DO NAVEGADOR
  // ==========================================================================
  //
  // Antes, o corpo trazia `clienteId` e a tela o preenchia com a loja da
  // SESSÃO — seguro para quem tem uma loja, impossível para uma agência.
  //
  // Ler o `clienteId` do corpo (ou do `state` da URL) seria a correção óbvia e
  // é uma vulnerabilidade: os dois são controláveis por quem está no navegador.
  // Qualquer pessoa conectaria a própria conta do ML a qualquer loja.
  //
  // `consumir_ticket_ml` resolve as três coisas de uma vez, no banco: o ticket é
  // de quem está perguntando, não foi usado, não venceu. E QUEIMA — o `update
  // ... where usado_em is null` é atômico, então duas chamadas com o mesmo
  // ticket produzem uma linha e um nada.
  let autenticado;
  try {
    autenticado = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }
  if (!autenticado.supabase) {
    return Response.json({ erro: "Supabase não configurado no servidor." }, { status: 503 });
  }

  const { data: consumo, error: erroTicket } = await autenticado.supabase
    .rpc("consumir_ticket_ml", { p_ticket: corpo.ticket })
    .maybeSingle();
  if (erroTicket) {
    return Response.json({ erro: "Falha ao validar a conexão." }, { status: 500 });
  }
  const doTicket = consumo as { cliente_id: string; marketplace: string } | null;
  if (!doTicket) {
    // Não distingue "não existe" de "já usado" de "venceu" de "é de outro":
    // as quatro pedem a mesma coisa da pessoa, e separá-las contaria a um
    // atacante qual dos quatro ele acertou.
    return Response.json(
      { erro: "Esta conexão expirou ou já foi usada. Clique em Conectar de novo." },
      { status: 409 }
    );
  }

  // A SEGUNDA CONFERÊNCIA, e ela não é redundante: entre criar o ticket e
  // voltar do Mercado Livre passam minutos, e nesses minutos a loja pode ter
  // saído do alcance de quem começou.
  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, doTicket.cliente_id);
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
    // A loja e o marketplace saem do TICKET, não do corpo — é o ponto inteiro
    // desta rota. `corpo.marketplace` deixou de ser lido.
    await salvarRefreshTokenServidor(clienteDaCredencial(),
      doTicket.cliente_id,
      tokens.refreshToken,
      doTicket.marketplace ?? "Mercado Livre",
      { sellerId: tokens.userId ?? null }
    );
    return Response.json({ ok: true, sellerId: tokens.userId ?? null });
  } catch (e) {
    return respostaDeErro("ml/conectar", e, "Falha ao conectar com o Mercado Livre.", 502);
  }
}
