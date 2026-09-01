import { criarRepositorio } from "../repositorio";
import { varianteParaApp, varianteParaBanco } from "../supabase/mappers";
import type { ProdutoVarianteRow } from "../supabase/database.types";
import type { ProdutoVariante } from "../types";

const repo = criarRepositorio<ProdutoVariante, ProdutoVarianteRow>({
  tabela: "produto_variantes",
  colecao: "produtoVariantes",
  prefixoIdLocal: "var",
  selecao: "*, produtos(nome)",
  paraApp: varianteParaApp,
  paraBanco: varianteParaBanco,
  rpcDeLote: "atualizar_variantes_em_lote",
});

export async function listarVariantesDoProduto(produtoId: string): Promise<ProdutoVariante[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

/** Todas as variantes (para joins em memória, ex.: auditoria da base). */
export async function listarTodasVariantes(): Promise<ProdutoVariante[]> {
  return repo.listar();
}

export async function buscarVariante(id: string): Promise<ProdutoVariante | null> {
  return repo.buscar(id);
}

export async function criarVariante(
  dados: Omit<ProdutoVariante, "id">
): Promise<ProdutoVariante> {
  return repo.criar(dados);
}

export async function atualizarVariante(
  id: string,
  dados: Partial<ProdutoVariante>
): Promise<ProdutoVariante | null> {
  return repo.atualizar(id, dados);
}

export async function arquivarVariante(id: string): Promise<ProdutoVariante | null> {
  return repo.atualizar(id, { status: "Arquivada" });
}

export async function excluirVariante(id: string): Promise<void> {
  return repo.excluir(id);
}

/** Cria várias variantes em lote (usado pelo gerador de grade). */
export async function criarVariantesEmLote(
  novas: Omit<ProdutoVariante, "id">[]
): Promise<ProdutoVariante[]> {
  const criadas: ProdutoVariante[] = [];
  for (const nova of novas) {
    criadas.push(await repo.criar(nova));
  }
  return criadas;
}

/** Cria muitas variantes de uma vez (importação de base com variações). */
export async function criarVariantesBulk(
  novas: Omit<ProdutoVariante, "id">[]
): Promise<void> {
  await repo.criarVarios(novas, { chunk: 200, retornar: false });
}

/** Atualiza várias variantes de uma vez (ex.: custos em massa). */
/** Aceita PARCIAIS (`{id, custo}`): atualiza só o que veio, sem tocar no resto. */
export async function atualizarVariantesBulk(
  variantes: (Partial<ProdutoVariante> & { id: string })[]
): Promise<void> {
  return repo.atualizarVarios(variantes);
}
