import { createItem, getById, listAll, removeItem, updateItem } from "../store";
import type { Anuncio } from "../types";

export async function listarAnuncios(): Promise<Anuncio[]> {
  return listAll<Anuncio>("anuncios");
}

export async function buscarAnuncio(id: string): Promise<Anuncio | null> {
  return getById<Anuncio>("anuncios", id) ?? null;
}

export async function listarAnunciosDoCliente(cliente: string): Promise<Anuncio[]> {
  return listAll<Anuncio>("anuncios").filter((a) => a.cliente === cliente);
}

export async function listarAnunciosDoProduto(produto: string): Promise<Anuncio[]> {
  return listAll<Anuncio>("anuncios").filter((a) => a.produto === produto);
}

export async function criarAnuncio(dados: Omit<Anuncio, "id">): Promise<Anuncio> {
  return createItem<Anuncio>("anuncios", dados, "anu");
}

export async function atualizarAnuncio(
  id: string,
  dados: Partial<Anuncio>
): Promise<Anuncio | null> {
  return updateItem<Anuncio>("anuncios", id, dados);
}

export async function excluirAnuncio(id: string): Promise<void> {
  removeItem("anuncios", id);
}
