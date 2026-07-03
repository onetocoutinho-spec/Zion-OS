import { createItem, getById, listAll, removeItem, updateItem } from "../store";
import type { Relatorio } from "../types";

export async function listarRelatorios(): Promise<Relatorio[]> {
  return listAll<Relatorio>("relatorios");
}

export async function buscarRelatorio(id: string): Promise<Relatorio | null> {
  return getById<Relatorio>("relatorios", id) ?? null;
}

export async function listarRelatoriosDoCliente(cliente: string): Promise<Relatorio[]> {
  return listAll<Relatorio>("relatorios").filter((r) => r.cliente === cliente);
}

export async function criarRelatorio(dados: Omit<Relatorio, "id">): Promise<Relatorio> {
  return createItem<Relatorio>("relatorios", dados, "rel");
}

export async function atualizarRelatorio(
  id: string,
  dados: Partial<Relatorio>
): Promise<Relatorio | null> {
  return updateItem<Relatorio>("relatorios", id, dados);
}

export async function excluirRelatorio(id: string): Promise<void> {
  removeItem("relatorios", id);
}
