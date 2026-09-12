// A caixa de correio do Mercado Livre.
//
// POST — o ML avisa que algo mudou. GET — o zion-ml vem buscar o que chegou.
//
// ===========================================================================
// POR QUE ESTA ROTA EXISTE NO ZION-OS, E NÃO NO ZION-ML
// ===========================================================================
//
// O ML só avisa quem tem endereço fixo: "200 em até 500 ms", senão ele
// DESATIVA os tópicos em silêncio e é preciso assinar de novo. O zion-ml roda
// numa máquina que desliga — não serve de endereço. Este projeto já está no
// ar, e é por isso que a caixa de correio mora aqui.
//
// O que NÃO mora aqui é o token das contas de cliente. A notificação do ML
// não traz o dado, traz o CAMINHO (`resource: /items/MLB123`); quem faz o GET
// daquele caminho é o zion-ml, com o token da conta certa, na máquina onde
// esses tokens vivem. Este servidor nunca precisa de credencial de cliente, e
// o que ele guarda é o aviso de que algo mudou — não o que mudou.
//
// ===========================================================================
// O URL É /ml-callback-zionml, FORA DE /api, E ISSO É DE PROPÓSITO
// ===========================================================================
//
// É o endereço que já está cadastrado e validado no DevCenter do ML. Mover
// para /api/... exigiria reconfigurar lá e revalidar — troca certa de fazer um
// dia, errada de fazer junto com a estreia. O resto do projeto segue em /api.
//
// ===========================================================================
// AS DECISÕES QUE O ORÇAMENTO DE 500 ms IMPÕE
// ===========================================================================
//
// Receber → gravar → responder. Nada mais. Nenhuma chamada ao ML, nenhuma
// regra de negócio, nenhuma leitura de outra tabela. Processamento dentro do
// request é como se perde o tópico: não com um erro, com lentidão.
//
// E o 200 NÃO é incondicional. É tentador responder 200 sempre para nunca
// perder um tópico, mas isso inverte o problema: o único resgate que o ML
// oferece é `GET /missed_feeds`, que lista apenas o que NÃO recebeu 200. Se
// respondermos 200 e falharmos ao gravar, a notificação some para sempre e
// não aparece em lugar nenhum. Falhando com 5xx, o ML repete por 1 hora e,
// se ainda assim não entrar, ela fica listada lá para resgate. Perder alto e
// visível é melhor que perder baixo e calado.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { decidirAcessoDoCron } from "@/lib/auth/autorizacaoDoCron";

// Uma notificação do ML tem centenas de bytes: oito campos curtos e um
// caminho. 16 KB é folga de uma ordem de grandeza — acima disso não é o ML.
const TAMANHO_MAXIMO = 16 * 1024;

// Teto do dreno. O zion-ml processa em lote e volta; sem teto, uma fila
// represada viraria uma resposta de megabytes numa função serverless.
const LOTE_PADRAO = 200;
const LOTE_MAXIMO = 1000;

/** O corpo que o ML manda. Nenhum campo é confiável — tudo vem da rede. */
interface NotificacaoMl {
  _id?: unknown;
  resource?: unknown;
  user_id?: unknown;
  topic?: unknown;
  application_id?: unknown;
  attempts?: unknown;
  sent?: unknown;
  received?: unknown;
}

function texto(valor: unknown, limite = 300): string | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === "object") return null;
  const s = String(valor).trim();
  return s ? s.slice(0, limite) : null;
}

function dataIso(valor: unknown): string | null {
  const s = texto(valor, 64);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export async function POST(request: Request) {
  // O ML não assina o callback — não há segredo compartilhado nem HMAC na
  // documentação. Logo, qualquer um pode postar aqui. A defesa não é
  // autenticação, é NÃO CONFIAR: só se grava o que tem forma de notificação,
  // o corpo é limitado, e o que se guarda são ponteiros. Um atacante consegue
  // no máximo encher a fila com caminhos que o zion-ml vai consultar e
  // descartar — por isso o `application_id` também é gravado, para que a
  // origem seja auditável depois.
  const declarado = Number(request.headers.get("content-length") ?? 0);
  if (declarado > TAMANHO_MAXIMO) return new Response(null, { status: 413 });

  let bruto: NotificacaoMl;
  try {
    const corpo = await request.text();
    if (corpo.length > TAMANHO_MAXIMO) return new Response(null, { status: 413 });
    bruto = JSON.parse(corpo) as NotificacaoMl;
  } catch {
    // Corpo ilegível não é falha nossa e repetir não vai melhorar: 400 para
    // o ML parar de tentar. É o único caso em que recusar é definitivo.
    return new Response(null, { status: 400 });
  }

  const notificacaoId = texto(bruto._id, 120);
  const recurso = texto(bruto.resource, 500);
  const topico = texto(bruto.topic, 80);
  const userIdMl = texto(bruto.user_id, 40);

  // Sem esses quatro não há o que processar depois: o zion-ml não saberia o
  // que buscar nem em qual conta. 400 em vez de 5xx — repetir não conserta
  // um corpo incompleto.
  if (!notificacaoId || !recurso || !topico || !userIdMl) {
    return new Response(null, { status: 400 });
  }

  if (!adminConfigurado()) {
    // Falha fechada e RUIDOSA. Sem banco não há caixa de correio, e responder
    // 200 aqui perderia a notificação em silêncio — exatamente o que o
    // desenho tenta evitar. 503 faz o ML repetir e, no limite, listar em
    // missed_feeds.
    console.error(JSON.stringify({ src: "ml.callback.sem-banco", topico, ts: new Date().toISOString() }));
    return new Response(null, { status: 503 });
  }

  const tentativas = Number(bruto.attempts);
  const linha = {
    notificacao_id: notificacaoId,
    topico,
    recurso,
    user_id_ml: userIdMl,
    application_id: texto(bruto.application_id, 40),
    tentativas: Number.isFinite(tentativas) ? tentativas : null,
    enviado_em: dataIso(bruto.sent),
    corpo: bruto as Record<string, unknown>,
  };

  try {
    const { error } = await getSupabaseAdmin()
      .from("ml_notificacoes")
      // `ignoreDuplicates` é o comportamento certo para retentativa: as 8
      // tentativas da mesma notificação trazem o mesmo `_id`, e a segunda em
      // diante não deve sobrescrever nem — pior — reabrir uma linha que o
      // zion-ml já processou.
      .upsert(linha, { onConflict: "notificacao_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  } catch (erro) {
    console.error(
      JSON.stringify({
        src: "ml.callback.falha-ao-gravar",
        topico,
        // `attempts` alto aqui é o sintoma que antecede a desativação dos
        // tópicos: significa que já falhamos nas tentativas anteriores.
        tentativas: linha.tentativas,
        erro: erro instanceof Error ? erro.message.slice(0, 300) : "desconhecido",
        ts: new Date().toISOString(),
      })
    );
    return new Response(null, { status: 503 });
  }

  return new Response(null, { status: 200 });
}

// ===========================================================================
// O DRENO
// ===========================================================================
//
// O zion-ml chama isto para saber o que chegou. Autenticado com a mesma
// CRON_SECRET do worker, pela mesma decisão pura e testada
// (src/lib/auth/autorizacaoDoCron.ts): em produção sem segredo, 503 — a rota
// se declara desligada em vez de aberta. Inventar um segundo esquema de
// segredo aqui seria criar uma segunda porta para auditar.
//
// Entregar NÃO marca como processado. Quem marca é o zion-ml, com POST em
// ?confirmar, depois de ter buscado o detalhe e gravado no banco dele. Se ele
// morrer no meio, a notificação continua pendente e volta no próximo dreno —
// entregar-e-esquecer perderia justamente o evento cujo processamento falhou.
export async function GET(request: Request) {
  const decisao = decidirAcessoDoCron({
    authorization: request.headers.get("authorization"),
    segredo: process.env.CRON_SECRET,
    vercelEnv: process.env.VERCEL_ENV,
  });
  if (!decisao.ok) {
    return Response.json({ erro: decisao.motivo }, { status: decisao.status });
  }
  if (!adminConfigurado()) {
    return Response.json({ erro: "Supabase admin não configurado." }, { status: 503 });
  }

  const url = new URL(request.url);
  const pedido = Number(url.searchParams.get("limite") ?? LOTE_PADRAO);
  const limite = Math.min(Math.max(Number.isFinite(pedido) ? pedido : LOTE_PADRAO, 1), LOTE_MAXIMO);

  const { data, error } = await getSupabaseAdmin()
    .from("ml_notificacoes")
    .select("id, notificacao_id, topico, recurso, user_id_ml, tentativas, enviado_em, recebido_em")
    .is("processado_em", null)
    .order("id", { ascending: true })
    .limit(limite);

  if (error) {
    return Response.json({ erro: error.message.slice(0, 300) }, { status: 503 });
  }
  return Response.json({ pendentes: data ?? [], limite });
}

// Confirmação do que JÁ foi processado do lado do zion-ml. Recebe os `id`
// devolvidos pelo dreno e marca `processado_em`.
//
// PATCH, e não POST, porque o POST desta rota é do Mercado Livre e é anônimo
// por natureza. Compartilhar o verbo obrigaria a distinguir as duas origens
// dentro do mesmo handler, e um erro nessa distinção abriria a confirmação
// para quem quisesse — ou, pior, faria uma notificação legítima ser tratada
// como confirmação. Verbos separados, portas separadas.
//
// Idempotente de propósito: reconfirmar um id já confirmado não é erro. O
// `.is("processado_em", null)` faz a segunda confirmação não mexer em nada e
// devolver zero, que é a resposta certa e não uma falha.
export async function PATCH(request: Request) {
  const decisao = decidirAcessoDoCron({
    authorization: request.headers.get("authorization"),
    segredo: process.env.CRON_SECRET,
    vercelEnv: process.env.VERCEL_ENV,
  });
  if (!decisao.ok) {
    return Response.json({ erro: decisao.motivo }, { status: decisao.status });
  }
  if (!adminConfigurado()) {
    return Response.json({ erro: "Supabase admin não configurado." }, { status: 503 });
  }

  let ids: unknown;
  try {
    ({ ids } = (await request.json()) as { ids?: unknown });
  } catch {
    return Response.json({ erro: "corpo inválido" }, { status: 400 });
  }

  const limpos = Array.isArray(ids)
    ? ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, LOTE_MAXIMO)
    : [];
  if (!limpos.length) {
    return Response.json({ erro: "informe ids: number[]" }, { status: 400 });
  }

  const { error, count } = await getSupabaseAdmin()
    .from("ml_notificacoes")
    .update({ processado_em: new Date().toISOString() }, { count: "exact" })
    .in("id", limpos)
    .is("processado_em", null);

  if (error) {
    return Response.json({ erro: error.message.slice(0, 300) }, { status: 503 });
  }
  return Response.json({ confirmados: count ?? 0 });
}
