// AS TAREFAS DA LOJA — gravação pelo servidor (a confirmação de uma proposta)
// e leitura pelo navegador (a lista na home, sob RLS). Tabela
// `tarefas_da_loja` (migração 069). Ver a decisão de produto lá: é da LOJA,
// não a `tarefas` da Zion.

import { getSupabase } from "@/lib/supabase/client";

export interface TarefaDaLoja {
  id: string;
  titulo: string;
  motivo: string | null;
  origem: "copilot" | "manual";
  status: "aberta" | "feita" | "descartada";
  prioridade: "alta" | "media" | "baixa";
  produtoId: string | null;
  criadaEm: string;
}

interface Linha {
  id: string;
  titulo: string;
  motivo: string | null;
  origem: string;
  status: string;
  prioridade: string;
  produto_id: string | null;
  criada_em: string;
}

function daLinha(l: Linha): TarefaDaLoja {
  return {
    id: l.id,
    titulo: l.titulo,
    motivo: l.motivo,
    origem: l.origem === "copilot" ? "copilot" : "manual",
    status: l.status === "feita" ? "feita" : l.status === "descartada" ? "descartada" : "aberta",
    prioridade: l.prioridade === "alta" ? "alta" : l.prioridade === "baixa" ? "baixa" : "media",
    produtoId: l.produto_id,
    criadaEm: l.criada_em,
  };
}

/** NAVEGADOR, sob RLS. As abertas primeiro, as mais novas no topo. */
export async function listarTarefasAbertas(clienteId: string): Promise<TarefaDaLoja[]> {
  const { data, error } = await getSupabase()
    .from("tarefas_da_loja")
    .select("id, titulo, motivo, origem, status, prioridade, produto_id, criada_em")
    .eq("cliente_id", clienteId)
    .eq("status", "aberta")
    .order("criada_em", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Linha[]).map(daLinha);
}

/** NAVEGADOR, sob RLS. Feita ou descartada — a linha fica, o histórico também. */
export async function concluirTarefa(id: string, status: "feita" | "descartada"): Promise<void> {
  const { error } = await getSupabase()
    .from("tarefas_da_loja")
    .update({ status, concluida_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
