import { createItem, getById, listAll, removeItem, updateItem } from "../store";
import type { Produto } from "../types";

export async function listarProdutos(): Promise<Produto[]> {
  return listAll<Produto>("produtos");
}

export async function buscarProduto(id: string): Promise<Produto | null> {
  return getById<Produto>("produtos", id) ?? null;
}

export async function listarProdutosDoCliente(cliente: string): Promise<Produto[]> {
  return listAll<Produto>("produtos").filter((p) => p.cliente === cliente);
}

export async function criarProduto(dados: Omit<Produto, "id">): Promise<Produto> {
  return createItem<Produto>("produtos", dados, "prd");
}

export async function atualizarProduto(
  id: string,
  dados: Partial<Produto>
): Promise<Produto | null> {
  return updateItem<Produto>("produtos", id, dados);
}

export async function excluirProduto(id: string): Promise<void> {
  removeItem("produtos", id);
}
