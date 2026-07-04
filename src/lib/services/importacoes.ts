import { criarRepositorio } from "../repositorio";
import { importacaoParaApp, importacaoParaBanco } from "../supabase/mappers";
import type { ImportacaoAnunciosRow } from "../supabase/database.types";
import type { ImportacaoAnuncios } from "../types";

const repo = criarRepositorio<ImportacaoAnuncios, ImportacaoAnunciosRow>({
  tabela: "importacoes_anuncios",
  colecao: "importacoesAnuncios",
  prefixoIdLocal: "imp",
  selecao: "*, clientes(empresa)",
  paraApp: importacaoParaApp,
  paraBanco: importacaoParaBanco,
});

export async function listarImportacoes(): Promise<ImportacaoAnuncios[]> {
  return repo.listar();
}

export async function buscarImportacao(id: string): Promise<ImportacaoAnuncios | null> {
  return repo.buscar(id);
}

export async function criarImportacao(
  dados: Omit<ImportacaoAnuncios, "id">
): Promise<ImportacaoAnuncios> {
  return repo.criar(dados);
}

export async function atualizarImportacao(
  id: string,
  dados: Partial<ImportacaoAnuncios>
): Promise<ImportacaoAnuncios | null> {
  return repo.atualizar(id, dados);
}

/**
 * Processa a importação de forma simulada: marca como concluída e considera
 * todos os anúncios processados. (No futuro, aqui entra o parser de CSV/API
 * que cria as auditorias de verdade.)
 */
export async function processarImportacaoSimulada(
  id: string
): Promise<ImportacaoAnuncios | null> {
  const imp = await repo.buscar(id);
  if (!imp) return null;
  return repo.atualizar(id, {
    status: "concluida",
    quantidadeProcessada: imp.quantidadeAnuncios,
    observacoes:
      imp.observacoes ||
      "Processada (simulação). Auditorias geradas para a base representativa.",
  });
}
