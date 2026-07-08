// Fila de otimização por PRODUTO (lado do cliente) — "Otimizar tudo" no servidor.
//
// O cliente enfileira os produtos e acompanha o status; quem consome é o
// worker do servidor (/api/otimizar/worker, disparado pelo Vercel Cron).

import { getSupabase, supabaseConfigurado } from "../supabase/client";

export interface StatusFila {
  pendente: number;
  processando: number;
  concluido: number;
  erro: number;
  total: number;
}

const VAZIO: StatusFila = { pendente: 0, processando: 0, concluido: 0, erro: 0, total: 0 };

/** Enfileira (ou reenfileira) produtos para otimização no servidor. */
export async function enfileirarProdutos(clienteId: string, produtoIds: string[]): Promise<number> {
  if (!supabaseConfigurado || produtoIds.length === 0) return 0;
  const linhas = produtoIds.map((produtoId) => ({
    cliente_id: clienteId,
    produto_id: produtoId,
    status: "pendente",
    tentativas: 0,
    erro: "",
    anuncio_id: null,
  }));
  const CHUNK = 500;
  for (let i = 0; i < linhas.length; i += CHUNK) {
    const { error } = await getSupabase()
      .from("fila_otimizacao_produto")
      .upsert(linhas.slice(i, i + CHUNK), { onConflict: "produto_id" });
    if (error) throw new Error(error.message);
  }
  return produtoIds.length;
}

/** Contagem por status da fila do cliente (para a barra de progresso). */
export async function statusFila(clienteId: string): Promise<StatusFila> {
  if (!supabaseConfigurado) return { ...VAZIO };
  const { data, error } = await getSupabase()
    .from("fila_otimizacao_produto")
    .select("status")
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
  const s: StatusFila = { ...VAZIO };
  for (const r of (data ?? []) as { status: string }[]) {
    if (r.status === "pendente") s.pendente++;
    else if (r.status === "processando") s.processando++;
    else if (r.status === "concluido") s.concluido++;
    else if (r.status === "erro") s.erro++;
    s.total++;
  }
  return s;
}

/** Remove os itens já concluídos da fila do cliente (limpeza opcional). */
export async function limparConcluidos(clienteId: string): Promise<void> {
  if (!supabaseConfigurado) return;
  const { error } = await getSupabase()
    .from("fila_otimizacao_produto")
    .delete()
    .eq("cliente_id", clienteId)
    .eq("status", "concluido");
  if (error) throw new Error(error.message);
}
