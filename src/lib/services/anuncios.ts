import { criarRepositorio } from "../repositorio";
import { anuncioParaApp, anuncioParaBanco } from "../supabase/mappers";
import type { AnuncioRow } from "../supabase/database.types";
import type { Anuncio } from "../types";

const repo = criarRepositorio<Anuncio, AnuncioRow>({
  tabela: "anuncios",
  colecao: "anuncios",
  prefixoIdLocal: "anu",
  selecao: "*, clientes(empresa), produtos(nome)",
  paraApp: anuncioParaApp,
  paraBanco: anuncioParaBanco,
});

export async function listarAnuncios(): Promise<Anuncio[]> {
  return repo.listar();
}

export async function buscarAnuncio(id: string): Promise<Anuncio | null> {
  return repo.buscar(id);
}

export async function listarAnunciosDoCliente(clienteId: string): Promise<Anuncio[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function listarAnunciosDoProduto(produtoId: string): Promise<Anuncio[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

export async function criarAnuncio(dados: Omit<Anuncio, "id">): Promise<Anuncio> {
  return repo.criar(dados);
}

export async function atualizarAnuncio(
  id: string,
  dados: Partial<Anuncio>
): Promise<Anuncio | null> {
  return repo.atualizar(id, dados);
}

export async function excluirAnuncio(id: string): Promise<void> {
  return repo.excluir(id);
}
