import { criarRepositorio } from "../repositorio";
import { auditoriaParaApp, auditoriaParaBanco } from "../supabase/mappers";
import type { AuditoriaAnuncioRow } from "../supabase/database.types";
import type { AuditoriaAnuncio, StatusAuditoria } from "../types";
import {
  calcularScore,
  classificarABC,
  classificarPrioridade,
  type SinaisQualidade,
} from "../auditoria";

const repo = criarRepositorio<AuditoriaAnuncio, AuditoriaAnuncioRow>({
  tabela: "auditorias_anuncios",
  colecao: "auditoriasAnuncios",
  prefixoIdLocal: "aud",
  selecao: "*, clientes(empresa)",
  paraApp: auditoriaParaApp,
  paraBanco: auditoriaParaBanco,
});

export async function listarAuditorias(): Promise<AuditoriaAnuncio[]> {
  return repo.listar();
}

export async function listarAuditoriasDaImportacao(
  importacaoId: string
): Promise<AuditoriaAnuncio[]> {
  return repo.listar({
    coluna: "importacao_id",
    valor: importacaoId,
    campoLocal: "importacaoId",
  });
}

export async function buscarAuditoria(id: string): Promise<AuditoriaAnuncio | null> {
  return repo.buscar(id);
}

export async function criarAuditoria(
  dados: Omit<AuditoriaAnuncio, "id">
): Promise<AuditoriaAnuncio> {
  return repo.criar(dados);
}

export async function atualizarAuditoria(
  id: string,
  dados: Partial<AuditoriaAnuncio>
): Promise<AuditoriaAnuncio | null> {
  return repo.atualizar(id, dados);
}

export async function alterarStatusAuditoria(
  id: string,
  status: StatusAuditoria
): Promise<AuditoriaAnuncio | null> {
  return repo.atualizar(id, { statusAuditoria: status });
}

// ---- Cálculo de score e classificação (reexportam a lógica pura) ----

/** Calcula o score de qualidade (0-100) a partir dos sinais do anúncio. */
export function calcularScoreDeAuditoria(sinais: SinaisQualidade): number {
  return calcularScore(sinais);
}

/** Classifica prioridade a partir de vendas, receita e score. */
export function classificarAuditoria(
  vendas: number,
  receitaEstimada: number,
  score: number
) {
  const abc = classificarABC(vendas, receitaEstimada);
  return { abc, prioridade: classificarPrioridade(score, abc) };
}
