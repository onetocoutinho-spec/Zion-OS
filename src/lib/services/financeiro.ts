import { createItem, getById, listAll, removeItem, updateItem } from "../store";
import type { RegistroFinanceiro } from "../types";

export async function listarFinanceiro(): Promise<RegistroFinanceiro[]> {
  return listAll<RegistroFinanceiro>("financeiro");
}

export async function buscarRegistroFinanceiro(
  id: string
): Promise<RegistroFinanceiro | null> {
  return getById<RegistroFinanceiro>("financeiro", id) ?? null;
}

export async function listarFinanceiroDoCliente(
  cliente: string
): Promise<RegistroFinanceiro[]> {
  return listAll<RegistroFinanceiro>("financeiro").filter((f) => f.cliente === cliente);
}

export async function criarRegistroFinanceiro(
  dados: Omit<RegistroFinanceiro, "id">
): Promise<RegistroFinanceiro> {
  return createItem<RegistroFinanceiro>("financeiro", dados, "fin");
}

export async function atualizarRegistroFinanceiro(
  id: string,
  dados: Partial<RegistroFinanceiro>
): Promise<RegistroFinanceiro | null> {
  return updateItem<RegistroFinanceiro>("financeiro", id, dados);
}

export async function marcarComoPago(id: string): Promise<RegistroFinanceiro | null> {
  return updateItem<RegistroFinanceiro>("financeiro", id, { statusPagamento: "Pago" });
}

export async function marcarComoAtrasado(id: string): Promise<RegistroFinanceiro | null> {
  return updateItem<RegistroFinanceiro>("financeiro", id, {
    statusPagamento: "Atrasado",
  });
}

export async function excluirRegistroFinanceiro(id: string): Promise<void> {
  removeItem("financeiro", id);
}
