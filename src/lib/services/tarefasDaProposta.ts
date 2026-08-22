// A EXECUÇÃO de uma proposta de tarefas — reservar, gravar a lista congelada,
// auditar. Risco baixo, mas o caminho é o mesmo de toda escrita do Copilot:
// Proposal persistida → clique → reserva atômica → escrita com o tenant da
// Proposal → `copilot_acoes`. ⚠️ Server-only.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { lerTarefasCongeladas } from "@/modules/assistant/domain/propostaDeTarefas";
import type { PropostaPersistida } from "@/modules/assistant/domain/propostaPersistida";
import { marcarProposta, registrarAcao, reservarParaExecucao } from "./copilotPropostas";

export type DesfechoDasTarefas =
  | { ok: true; criadas: number }
  | { ok: false; jaFeito: true }
  | { ok: false; jaFeito?: false; mensagem: string };

export async function executarTarefasDaProposta(p: PropostaPersistida, usuario: string | null): Promise<DesfechoDasTarefas> {
  const tarefas = p.tipo === "tarefas" ? lerTarefasCongeladas(p.texto) : null;
  if (!tarefas) {
    await marcarProposta(p.id, "falhou", "lista congelada ilegível");
    return { ok: false, mensagem: "Essa proposta não tem a lista de tarefas. Peça de novo e eu monto outra." };
  }

  const reservou = await reservarParaExecucao(p.id);
  if (!reservou) {
    await registrarAcao({
      clienteId: p.clienteId, conversaId: p.conversaId, propostaId: p.id, executadaPor: usuario,
      ferramenta: "confirmar:tarefas", alvos: p.alvos, antes: null, depois: null,
      resultado: "recusada", afetados: 0, erro: "corrida_perdida",
    });
    return { ok: false, jaFeito: true };
  }

  const { data, error } = await getSupabaseAdmin()
    .from("tarefas_da_loja")
    .insert(
      tarefas.map((t) => ({
        cliente_id: p.clienteId,
        titulo: t.titulo,
        motivo: t.motivo || null,
        origem: "copilot",
        status: "aberta",
        prioridade: t.prioridade,
        produto_id: t.produtoId ?? null,
        proposta_id: p.id,
        criada_por: usuario,
      }))
    )
    .select("id");
  if (error) {
    await marcarProposta(p.id, "falhou", error.message);
    await registrarAcao({
      clienteId: p.clienteId, conversaId: p.conversaId, propostaId: p.id, executadaPor: usuario,
      ferramenta: "confirmar:tarefas", alvos: p.alvos, antes: null, depois: null,
      resultado: "falhou", afetados: 0, erro: error.message,
    });
    return { ok: false, mensagem: "Não consegui gravar as tarefas agora. Tente de novo." };
  }
  const criadas = data?.length ?? 0;
  await registrarAcao({
    clienteId: p.clienteId, conversaId: p.conversaId, propostaId: p.id, executadaPor: usuario,
    ferramenta: "confirmar:tarefas", alvos: p.alvos, antes: null,
    depois: { criadas, titulos: tarefas.map((t) => t.titulo) },
    resultado: criadas === tarefas.length ? "sucesso" : "parcial", afetados: criadas,
  });
  return { ok: true, criadas };
}
