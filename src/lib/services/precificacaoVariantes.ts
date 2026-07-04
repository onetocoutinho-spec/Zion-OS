import { criarRepositorio } from "../repositorio";
import { precificacaoParaApp, precificacaoParaBanco } from "../supabase/mappers";
import type { PrecificacaoVarianteRow } from "../supabase/database.types";
import type { PrecificacaoVariante } from "../types";

const repo = criarRepositorio<PrecificacaoVariante, PrecificacaoVarianteRow>({
  tabela: "precificacao_variantes",
  colecao: "precificacaoVariantes",
  prefixoIdLocal: "pcv",
  selecao:
    "*, produto_variantes(cor, tamanho, voltagem, sabor, aroma, modelo_variacao)",
  paraApp: precificacaoParaApp,
  paraBanco: precificacaoParaBanco,
});

export async function listarPrecificacoesDoProduto(
  produtoId: string
): Promise<PrecificacaoVariante[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

export async function criarPrecificacao(
  dados: Omit<PrecificacaoVariante, "id">
): Promise<PrecificacaoVariante> {
  return repo.criar(dados);
}

export async function atualizarPrecificacao(
  id: string,
  dados: Partial<PrecificacaoVariante>
): Promise<PrecificacaoVariante | null> {
  return repo.atualizar(id, dados);
}

export async function excluirPrecificacao(id: string): Promise<void> {
  return repo.excluir(id);
}
