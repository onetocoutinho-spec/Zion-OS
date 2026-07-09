import { criarRepositorio } from "../repositorio";
import { produtoParaApp, produtoParaBanco } from "../supabase/mappers";
import type { ProdutoRow } from "../supabase/database.types";
import type { Produto } from "../types";

const repo = criarRepositorio<Produto, ProdutoRow>({
  tabela: "produtos",
  colecao: "produtos",
  prefixoIdLocal: "prd",
  selecao: "*, clientes(empresa)",
  paraApp: produtoParaApp,
  paraBanco: produtoParaBanco,
});

export async function listarProdutos(): Promise<Produto[]> {
  return repo.listar();
}

export async function buscarProduto(id: string): Promise<Produto | null> {
  return repo.buscar(id);
}

export async function listarProdutosDoCliente(clienteId: string): Promise<Produto[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarProduto(dados: Omit<Produto, "id">): Promise<Produto> {
  return repo.criar(dados);
}

/** Cria muitos produtos de uma vez (importação da base). */
export async function criarProdutos(dados: Omit<Produto, "id">[]): Promise<Produto[]> {
  return repo.criarVarios(dados);
}

export async function atualizarProduto(
  id: string,
  dados: Partial<Produto>
): Promise<Produto | null> {
  return repo.atualizar(id, dados);
}

export async function excluirProduto(id: string): Promise<void> {
  return repo.excluir(id);
}

/** Atualiza vários produtos de uma vez (ex.: custos em massa). */
export async function atualizarProdutosBulk(produtos: Produto[]): Promise<void> {
  return repo.atualizarVarios(produtos);
}

/**
 * Exclui os produtos importados do Mercado Livre do cliente (variações caem
 * em cascata). Usado pela reimportação "substituir".
 */
export async function excluirProdutosImportadosML(clienteId: string): Promise<void> {
  // Prefixo comum "Importado do " cobre os dois formatos gravados ao longo do
  // tempo: "Importado do ML (...)" e "Importado do Mercado Livre (...)".
  return repo.excluirPorFiltro(
    { coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" },
    { coluna: "observacoes", campoLocal: "observacoes", valor: "Importado do " }
  );
}
