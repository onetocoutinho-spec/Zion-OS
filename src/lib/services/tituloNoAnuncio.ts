// A EXECUÇÃO da correção de título num anúncio publicado. ⚠️ Server-only.
//
// A PRIMEIRA escrita de conteúdo do projeto num item que já está no ar. Por
// isso ela carrega, junta, todas as travas que o projeto aprendeu — e uma
// nova, que é a razão de a etapa existir:
//
//   1. POSSE      — o MLB é desta loja? Pergunta ao banco com o tenant da
//                   Proposal. Item desconhecido = recusa. (A mesma trava de
//                   `reativar_anuncio`: identificador vindo do modelo carrega
//                   texto que a lojista não escreveu.)
//   2. INFRAÇÃO   — o ML cancelou este item? Falha FECHADA: se não der para
//                   confirmar que está limpo, não escreve. Mexer no que o ML
//                   puniu é reincidência.
//   3. RESERVA    — `pendente` → `executada` atômico, ANTES do efeito externo.
//                   É o que impede o duplo clique de escrever duas vezes.
//   4. ESCRITA    — `PUT /items/{id}` com `{title}`.
//   5. VERIFICAÇÃO — relê o item e COMPARA. Sem isto, "200 OK" viraria
//                   "pronto", e este caminho nunca foi medido contra a API
//                   real. É a trava nova, e é a que torna a etapa publicável.
//   6. AUDITORIA  — `copilot_acoes` com antes/depois, em TODO desfecho.
//
// A ordem não é estética: reservar depois de escrever deixaria janela para
// duas escritas; verificar antes de escrever não verificaria nada.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  atualizarTituloDoItem,
  renovarToken,
  RenovacaoRecusadaError,
  mlbsComInfracao,
  retratoDoItem,
} from "@/lib/marketplaces/mercadolivre";
import {
  atualizarRefreshTokenServidor,
  clienteDaCredencial,
  lerCanalServidor,
} from "@/modules/integration/infrastructure/canalServidor";
import {
  verificarCorrecao,
  type ResultadoDaCorrecao,
} from "@/modules/publication/domain/correcaoNoAnuncio";
import type { PropostaPersistida } from "@/modules/assistant/domain/propostaPersistida";
import { marcarProposta, registrarAcao, reservarParaExecucao } from "./copilotPropostas";

const MARKETPLACE = "Mercado Livre";

/**
 * O anúncio no ar deste produto, com o título que o COMPRADOR vê agora.
 *
 * É o insumo do cartão: mostrar "atual" com o título do catálogo do Zion seria
 * mostrar o que a lojista já sabe, e não o que está errado na vitrine.
 * `null` = o produto não tem anúncio publicado nesta loja.
 */
export async function tituloNoArDoProduto(
  clienteId: string,
  produtoId: string,
  credenciais: { clientId: string; clientSecret: string }
): Promise<{ anuncioId: string; mlb: string; titulo: string; permalink: string | null } | null> {
  const { data } = await getSupabaseAdmin()
    .from("anuncios_gerados")
    .select("id, ml_item_id, ml_permalink")
    .eq("cliente_id", clienteId)
    .eq("produto_id", produtoId)
    .not("ml_item_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1);
  const l = ((data ?? []) as { id: string; ml_item_id: string; ml_permalink: string | null }[])[0];
  if (!l) return null;

  const canal = await lerCanalServidor(clienteDaCredencial(), clienteId, MARKETPLACE);
  if (!canal?.refreshToken) return null;
  const tokens = await renovarToken({ ...credenciais, refreshToken: canal.refreshToken });
  await atualizarRefreshTokenServidor(clienteDaCredencial(), clienteId, tokens.refreshToken, MARKETPLACE);
  const retrato = await retratoDoItem(tokens.accessToken, l.ml_item_id);
  return {
    anuncioId: l.id,
    mlb: l.ml_item_id,
    titulo: retrato.titulo,
    permalink: retrato.permalink ?? l.ml_permalink,
  };
}

export type DesfechoDaCorrecao =
  | { ok: true; resultado: ResultadoDaCorrecao; mlb: string }
  | { ok: false; jaFeito: true }
  | { ok: false; jaFeito?: false; mensagem: string; motivo?: string };

/**
 * O anúncio desta loja: o MLB, o título de hoje e o PAYLOAD INTEIRO.
 *
 * O payload volta inteiro de propósito. `anuncio` é um jsonb com o anúncio
 * completo — descrição, ficha técnica, palavras-chave, tabela de medidas — e
 * um `update({ anuncio: { tituloOtimizado } })` substituiria a coluna inteira,
 * apagando todo o resto sem erro nenhum. A gravação depois é por MESCLA.
 */
async function anuncioDaLoja(
  clienteId: string,
  anuncioId: string
): Promise<{ mlb: string; titulo: string; payload: Record<string, unknown> } | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("anuncios_gerados")
    .select("ml_item_id, anuncio")
    .eq("id", anuncioId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  // Erro de leitura NÃO vira "não é dela" nem "é dela": vira recusa, e quem
  // chama distingue. Deixar passar aqui seria escrever sem saber de quem é.
  if (error) throw new Error("não consegui conferir de quem é este anúncio");
  const l = data as {
    ml_item_id: string | null;
    anuncio: (Record<string, unknown> & { tituloOtimizado?: string }) | null;
  } | null;
  if (!l?.ml_item_id) return null;
  const payload = l.anuncio ?? {};
  return {
    mlb: l.ml_item_id,
    titulo: String(payload.tituloOtimizado ?? "").trim(),
    payload,
  };
}

/**
 * Executa a correção do título.
 *
 * `p.texto` é o título novo; `p.alvos[0]` é o registro do anúncio. O tenant é
 * SEMPRE o da Proposal — nunca um id que veio junto do pedido.
 */
export async function executarTituloNoAnuncio(
  p: PropostaPersistida,
  usuario: string | null,
  credenciais: { clientId: string; clientSecret: string }
): Promise<DesfechoDaCorrecao> {
  const anuncioId = p.alvos[0];
  const novo = (p.texto ?? "").trim();
  const auditar = (
    resultado: "sucesso" | "recusada" | "falhou",
    dados: { antes?: unknown; depois?: unknown; erro?: string; afetados?: number }
  ) =>
    registrarAcao({
      clienteId: p.clienteId,
      conversaId: p.conversaId,
      propostaId: p.id,
      executadaPor: usuario,
      ferramenta: "confirmar:titulo_no_ml",
      alvos: p.alvos,
      antes: dados.antes ?? null,
      depois: dados.depois ?? null,
      resultado,
      afetados: dados.afetados ?? 0,
      ...(dados.erro ? { erro: dados.erro } : {}),
    });

  if (!anuncioId || !novo) {
    await marcarProposta(p.id, "falhou", "proposta sem anúncio ou sem título");
    return { ok: false, mensagem: "Essa proposta não tem o anúncio ou o título. Peça de novo e eu monto outra." };
  }

  // 1) POSSE.
  let alvo: Awaited<ReturnType<typeof anuncioDaLoja>>;
  try {
    alvo = await anuncioDaLoja(p.clienteId, anuncioId);
  } catch {
    await marcarProposta(p.id, "falhou", "falha ao conferir a posse do anúncio");
    await auditar("recusada", { erro: "posse_indeterminada" });
    return { ok: false, mensagem: "Não consegui confirmar que este anúncio é desta loja. Não mexi em nada." };
  }
  if (!alvo) {
    await marcarProposta(p.id, "falhou", "anúncio não é desta loja ou não está publicado");
    await auditar("recusada", { erro: "fora_do_tenant_ou_sem_mlb" });
    return { ok: false, mensagem: "Não achei este anúncio publicado nesta loja. Não mexi em nada." };
  }

  // 2) CREDENCIAL.
  const canal = await lerCanalServidor(clienteDaCredencial(), p.clienteId, MARKETPLACE);
  if (!canal?.refreshToken) {
    await marcarProposta(p.id, "falhou", "loja não conectada ao Mercado Livre");
    await auditar("recusada", { erro: "nao_conectado" });
    return { ok: false, mensagem: "A loja não está conectada ao Mercado Livre.", motivo: "nao_conectado" };
  }
  let tokens: Awaited<ReturnType<typeof renovarToken>>;
  try {
    tokens = await renovarToken({ ...credenciais, refreshToken: canal.refreshToken });
  } catch (e) {
    const recusada = e instanceof RenovacaoRecusadaError && e.credencialRecusada;
    await marcarProposta(p.id, "falhou", recusada ? "credencial recusada" : "falha ao renovar credencial");
    await auditar("recusada", { erro: recusada ? "reconectar" : "falha_credencial" });
    return {
      ok: false,
      mensagem: recusada
        ? "O Mercado Livre recusou a credencial guardada. É preciso reconectar a loja."
        : "Não consegui falar com o Mercado Livre agora. Não mexi em nada.",
      motivo: recusada ? "reconectar" : "falha_credencial",
    };
  }
  await atualizarRefreshTokenServidor(clienteDaCredencial(), p.clienteId, tokens.refreshToken, MARKETPLACE);

  // 3) INFRAÇÃO — falha FECHADA.
  try {
    const punidos = await mlbsComInfracao(tokens.accessToken, [alvo.mlb]);
    if (punidos.includes(alvo.mlb)) {
      await marcarProposta(p.id, "falhou", "anúncio com infração no Mercado Livre");
      await auditar("recusada", { erro: "infracao" });
      return {
        ok: false,
        mensagem:
          "Este anúncio está marcado com infração no Mercado Livre. Não mexo nele: alterar o que o ML puniu é reincidência, e isso pode custar a conta.",
        motivo: "infracao",
      };
    }
  } catch {
    await marcarProposta(p.id, "falhou", "não foi possível conferir infração");
    await auditar("recusada", { erro: "infracao_indeterminada" });
    return {
      ok: false,
      mensagem: "Não consegui confirmar no Mercado Livre que este anúncio está sem infração. Por segurança, não mexi.",
      motivo: "infracao_indeterminada",
    };
  }

  // 3.5) O TÍTULO QUE ESTÁ NO AR — lido AGORA, com o token na mão.
  //
  // O "antes" não pode vir do catálogo do Zion: o caso que esta etapa existe
  // para consertar é justamente o dos dois divergirem. Comparar a releitura
  // com o título do Zion faria a verificação medir a coisa errada — e diria
  // "o ML não aplicou" quando ele aplicou.
  let antes: string;
  try {
    antes = (await retratoDoItem(tokens.accessToken, alvo.mlb)).titulo;
  } catch {
    await marcarProposta(p.id, "falhou", "não foi possível ler o título atual");
    await auditar("recusada", { erro: "leitura_do_titulo_falhou" });
    return {
      ok: false,
      mensagem: "Não consegui ler o título que está no ar agora. Sem saber o que está lá, não troco.",
    };
  }
  if (antes.trim() === novo) {
    await marcarProposta(p.id, "falhou", "o título já é esse");
    await auditar("recusada", { antes: { titulo: antes }, erro: "sem_mudanca" });
    return { ok: false, mensagem: "O anúncio já está com esse título. Não mexi em nada." };
  }

  // 4) RESERVA — antes do efeito externo.
  const reservou = await reservarParaExecucao(p.id);
  if (!reservou) {
    await auditar("recusada", { erro: "corrida_perdida" });
    return { ok: false, jaFeito: true };
  }

  // 5) ESCRITA.
  try {
    await atualizarTituloDoItem(tokens.accessToken, alvo.mlb, novo);
  } catch (e) {
    const mensagem = e instanceof Error ? e.message : "O Mercado Livre recusou a troca do título.";
    await marcarProposta(p.id, "falhou", mensagem);
    await auditar("falhou", { antes: { titulo: antes }, erro: mensagem });
    return { ok: false, mensagem };
  }

  // 6) VERIFICAÇÃO — a leitura NOVA. É ela que decide o que se pode afirmar.
  //
  // Falha de leitura não é falha da escrita: o título pode ter sido trocado. O
  // veredicto `nao_confirmada` existe exatamente para esse caso, e a frase que
  // ele carrega não afirma nem nega.
  let lido: string | null = null;
  try {
    lido = (await retratoDoItem(tokens.accessToken, alvo.mlb)).titulo;
  } catch {
    lido = null;
  }
  const resultado = verificarCorrecao(antes, novo, lido);

  // 7) O CATÁLOGO acompanha — só quando o ML confirmou.
  //
  // Gravar o título novo aqui com o ML mostrando outro faria as duas telas
  // discordarem, e a do Zion mentiria sobre o que o comprador vê.
  if (resultado.veredicto === "confirmada") {
    const { error } = await getSupabaseAdmin()
      .from("anuncios_gerados")
      // MESCLA, não substituição: o jsonb carrega o anúncio inteiro.
      .update({ anuncio: { ...alvo.payload, tituloOtimizado: novo } })
      .eq("id", anuncioId)
      .eq("cliente_id", p.clienteId);
    if (error) console.error("[copilot/titulo_no_ml] o ML aplicou e o registro não acompanhou:", error);
  }

  await auditar(resultado.veredicto === "confirmada" ? "sucesso" : "falhou", {
    antes: { titulo: antes },
    depois: { titulo: resultado.agora, veredicto: resultado.veredicto },
    afetados: resultado.veredicto === "confirmada" ? 1 : 0,
    ...(resultado.veredicto === "confirmada" ? {} : { erro: resultado.veredicto }),
  });

  return { ok: true, resultado, mlb: alvo.mlb };
}
