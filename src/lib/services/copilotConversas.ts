// Persistência da conversa do Copilot — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin. Nunca use no navegador.
//
// O `localStorage` continua existindo na tela, mas deixa de ser a VERDADE. Ele
// não atravessa dispositivo, não sobrevive à limpeza do navegador, e não sabe
// nada sobre tenant — três coisas que a fonte autoritativa de um histórico
// operacional precisa saber.
//
// A conversa é gravada pela ROTA, com o tenant vindo da sessão. A tela não
// escreve: se escrevesse, o histórico do lojista seria o que o navegador dele
// resolvesse afirmar.
//
// Falha de gravação NUNCA derruba a resposta. Perder o registro de um turno é
// ruim; perder a resposta que o lojista está esperando por causa disso é pior,
// e transformaria uma indisponibilidade de log numa indisponibilidade de
// produto.

import { getSupabaseAdmin } from "../supabase/admin";

export interface TurnoGravado {
  pergunta: string;
  resposta: string;
  ferramentas: readonly string[];
  tokens: number;
}

/**
 * Garante a conversa — cria na primeira mensagem, reusa nas seguintes.
 *
 * Devolve `null` quando não deu: quem chama segue sem histórico em vez de
 * falhar. O id vem do cliente para o fio sobreviver ao recarregamento, mas o
 * TENANT é conferido aqui: um id de conversa de outro cliente não é reusado,
 * é ignorado e uma nova é criada.
 */
export async function garantirConversa(
  clienteId: string,
  usuarioId: string | null,
  conversaId: string | null,
  contexto: { rota?: string; produtoId?: string | null }
): Promise<string | null> {
  const admin = getSupabaseAdmin();
  try {
    if (conversaId) {
      const { data } = await admin
        .from("copilot_conversas")
        .select("id, cliente_id")
        .eq("id", conversaId)
        .maybeSingle();
      const linha = data as { id: string; cliente_id: string } | null;
      // Conversa de OUTRO cliente: não reusa e não conta por quê. Continuar
      // nela deixaria as mensagens deste lojista no histórico do outro.
      if (linha && linha.cliente_id === clienteId) {
        await admin
          .from("copilot_conversas")
          .update({ atualizada_em: new Date().toISOString() })
          .eq("id", linha.id);
        return linha.id;
      }
    }
    const { data, error } = await admin
      .from("copilot_conversas")
      .insert({
        cliente_id: clienteId,
        criada_por: usuarioId,
        rota: contexto.rota ?? null,
        produto_id: contexto.produtoId ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return null;
    return (data as { id: string }).id;
  } catch (e) {
    console.error("[copilot] falha ao garantir conversa:", e);
    return null;
  }
}

/**
 * Grava o turno — pergunta e resposta, com o rastro de ferramentas.
 *
 * O rastro é o que permite responder "de onde veio esse número?" sem
 * reprocessar a conversa. Sem ele, o histórico guarda o que foi dito e perde
 * o que foi consultado — que é justamente a parte auditável.
 */
export async function gravarTurno(
  clienteId: string,
  conversaId: string,
  turno: TurnoGravado
): Promise<void> {
  try {
    await getSupabaseAdmin()
      .from("copilot_mensagens")
      .insert([
        {
          conversa_id: conversaId,
          cliente_id: clienteId,
          papel: "lojista",
          texto: turno.pergunta,
        },
        {
          conversa_id: conversaId,
          cliente_id: clienteId,
          papel: "assistente",
          texto: turno.resposta,
          ferramentas: turno.ferramentas,
          tokens: turno.tokens,
        },
      ]);
  } catch (e) {
    // Ver o cabeçalho: perder o registro é ruim, perder a resposta é pior.
    console.error("[copilot] falha ao gravar turno:", e);
  }
}
