import { criarRepositorio } from "../repositorio";
import { atributoParaApp, atributoParaBanco } from "../supabase/mappers";
import type { ProdutoAtributoRow } from "../supabase/database.types";
import type { ProdutoAtributo } from "../types";

const repo = criarRepositorio<ProdutoAtributo, ProdutoAtributoRow>({
  tabela: "produto_atributos",
  colecao: "produtoAtributos",
  prefixoIdLocal: "atr",
  selecao: "*",
  paraApp: atributoParaApp,
  paraBanco: atributoParaBanco,
});

export async function listarAtributosDoProduto(produtoId: string): Promise<ProdutoAtributo[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

export async function criarAtributo(
  dados: Omit<ProdutoAtributo, "id">
): Promise<ProdutoAtributo> {
  return repo.criar(dados);
}

export async function atualizarAtributo(
  id: string,
  dados: Partial<ProdutoAtributo>
): Promise<ProdutoAtributo | null> {
  return repo.atualizar(id, dados);
}

export async function excluirAtributo(id: string): Promise<void> {
  return repo.excluir(id);
}
