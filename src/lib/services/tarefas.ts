import { createItem, getById, listAll, removeItem, updateItem } from "../store";
import type { Tarefa } from "../types";

export async function listarTarefas(): Promise<Tarefa[]> {
  return listAll<Tarefa>("tarefas");
}

export async function buscarTarefa(id: string): Promise<Tarefa | null> {
  return getById<Tarefa>("tarefas", id) ?? null;
}

export async function listarTarefasDoCliente(cliente: string): Promise<Tarefa[]> {
  return listAll<Tarefa>("tarefas").filter((t) => t.cliente === cliente);
}

export async function listarTarefasDoProduto(produto: string): Promise<Tarefa[]> {
  return listAll<Tarefa>("tarefas").filter((t) => t.produto === produto);
}

export async function listarTarefasDoAnuncio(anuncio: string): Promise<Tarefa[]> {
  return listAll<Tarefa>("tarefas").filter((t) => t.anuncio === anuncio);
}

export async function criarTarefa(dados: Omit<Tarefa, "id">): Promise<Tarefa> {
  return createItem<Tarefa>("tarefas", dados, "tar");
}

export async function atualizarTarefa(
  id: string,
  dados: Partial<Tarefa>
): Promise<Tarefa | null> {
  return updateItem<Tarefa>("tarefas", id, dados);
}

export async function concluirTarefa(id: string): Promise<Tarefa | null> {
  return updateItem<Tarefa>("tarefas", id, { status: "Concluído" });
}

export async function excluirTarefa(id: string): Promise<void> {
  removeItem("tarefas", id);
}
