// Serviço de Clientes. Todas as funções são assíncronas de propósito:
// ao migrar para Supabase, só o corpo delas muda — as telas não.

import { createItem, getById, listAll, removeItem, updateItem } from "../store";
import type { Cliente, ClienteStatus } from "../types";

export async function listarClientes(): Promise<Cliente[]> {
  return listAll<Cliente>("clientes");
}

export async function buscarCliente(id: string): Promise<Cliente | null> {
  return getById<Cliente>("clientes", id) ?? null;
}

export async function criarCliente(dados: Omit<Cliente, "id">): Promise<Cliente> {
  return createItem<Cliente>("clientes", dados, "cli");
}

export async function atualizarCliente(
  id: string,
  dados: Partial<Cliente>
): Promise<Cliente | null> {
  return updateItem<Cliente>("clientes", id, dados);
}

export async function excluirCliente(id: string): Promise<void> {
  removeItem("clientes", id);
}

export async function alterarStatusCliente(
  id: string,
  status: ClienteStatus
): Promise<Cliente | null> {
  return updateItem<Cliente>("clientes", id, { status });
}
