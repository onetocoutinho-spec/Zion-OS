import { criarRepositorio } from "../repositorio";
import { imagemParaApp, imagemParaBanco } from "../supabase/mappers";
import type { ImagemProdutoRow } from "../supabase/database.types";
import type { ImagemProduto } from "../types";

const repo = criarRepositorio<ImagemProduto, ImagemProdutoRow>({
  tabela: "imagens_produto",
  colecao: "imagensProduto",
  prefixoIdLocal: "img",
  selecao: "*",
  paraApp: imagemParaApp,
  paraBanco: imagemParaBanco,
});

export async function listarImagensDoProduto(produtoId: string): Promise<ImagemProduto[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

export async function listarImagensDoAnuncio(anuncioId: string): Promise<ImagemProduto[]> {
  return repo.listar({ coluna: "anuncio_id", valor: anuncioId, campoLocal: "anuncioId" });
}

export async function criarImagem(dados: Omit<ImagemProduto, "id">): Promise<ImagemProduto> {
  return repo.criar(dados);
}

/** Cria muitas imagens de uma vez (importação do ML: fotos reais dos anúncios). */
export async function criarImagensBulk(dados: Omit<ImagemProduto, "id">[]): Promise<void> {
  await repo.criarVarios(dados, { chunk: 100, retornar: false });
}

export async function atualizarImagem(
  id: string,
  dados: Partial<ImagemProduto>
): Promise<ImagemProduto | null> {
  return repo.atualizar(id, dados);
}

export async function excluirImagem(id: string): Promise<void> {
  return repo.excluir(id);
}

/**
 * Todas as imagens, para contar em massa quantos produtos já têm foto.
 *
 * A tela inicial precisa saber "quantos produtos estão sem foto" — perguntar
 * produto a produto seriam 73 consultas para responder um número.
 */
export async function listarTodasImagens(): Promise<ImagemProduto[]> {
  return repo.listar();
}
