import { criarRepositorio } from "../repositorio";
import { anuncioVarianteParaApp, anuncioVarianteParaBanco } from "../supabase/mappers";
import type { AnuncioVarianteRow } from "../supabase/database.types";
import type { AnuncioVariante } from "../types";

const repo = criarRepositorio<AnuncioVariante, AnuncioVarianteRow>({
  tabela: "anuncio_variantes",
  colecao: "anuncioVariantes",
  prefixoIdLocal: "anv",
  selecao:
    "*, produto_variantes(cor, tamanho, voltagem, sabor, aroma, modelo_variacao)",
  paraApp: anuncioVarianteParaApp,
  paraBanco: anuncioVarianteParaBanco,
});

export async function listarVariantesDoAnuncio(anuncioId: string): Promise<AnuncioVariante[]> {
  return repo.listar({ coluna: "anuncio_id", valor: anuncioId, campoLocal: "anuncioId" });
}

export async function vincularVarianteAoAnuncio(
  dados: Omit<AnuncioVariante, "id">
): Promise<AnuncioVariante> {
  return repo.criar(dados);
}

export async function atualizarAnuncioVariante(
  id: string,
  dados: Partial<AnuncioVariante>
): Promise<AnuncioVariante | null> {
  return repo.atualizar(id, dados);
}

export async function desvincularVariante(id: string): Promise<void> {
  return repo.excluir(id);
}
