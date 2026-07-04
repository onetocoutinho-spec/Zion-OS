import { criarRepositorio } from "../repositorio";
import { problemaParaApp, problemaParaBanco } from "../supabase/mappers";
import type { ProblemaAnuncioRow } from "../supabase/database.types";
import type { ProblemaAnuncio } from "../types";

const repo = criarRepositorio<ProblemaAnuncio, ProblemaAnuncioRow>({
  tabela: "problemas_anuncio",
  colecao: "problemasAnuncio",
  prefixoIdLocal: "prb",
  selecao: "*",
  paraApp: problemaParaApp,
  paraBanco: problemaParaBanco,
});

export async function listarProblemasDaAuditoria(
  auditoriaId: string
): Promise<ProblemaAnuncio[]> {
  return repo.listar({ coluna: "auditoria_id", valor: auditoriaId, campoLocal: "auditoriaId" });
}

export async function criarProblema(
  dados: Omit<ProblemaAnuncio, "id">
): Promise<ProblemaAnuncio> {
  return repo.criar(dados);
}

export async function atualizarProblema(
  id: string,
  dados: Partial<ProblemaAnuncio>
): Promise<ProblemaAnuncio | null> {
  return repo.atualizar(id, dados);
}

export async function excluirProblema(id: string): Promise<void> {
  return repo.excluir(id);
}
