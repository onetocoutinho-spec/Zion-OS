import { criarRepositorio } from "../repositorio";
import {
  agenteParaApp,
  agenteParaBanco,
  execucaoParaApp,
  execucaoParaBanco,
} from "../supabase/mappers";
import type { AgenteRow, ExecucaoRow } from "../supabase/database.types";
import type { AgenteIA, ExecucaoAgente } from "../types";

const repo = criarRepositorio<AgenteIA, AgenteRow>({
  tabela: "agentes",
  colecao: "agentes",
  prefixoIdLocal: "agt",
  selecao: "*",
  paraApp: agenteParaApp,
  paraBanco: agenteParaBanco,
});

const repoExecucoes = criarRepositorio<ExecucaoAgente, ExecucaoRow>({
  tabela: "execucoes_agentes",
  colecao: "execucoes",
  prefixoIdLocal: "exe",
  selecao: "*, agentes(nome)",
  paraApp: execucaoParaApp,
  paraBanco: execucaoParaBanco,
  ordenarPor: "data_hora",
});

export async function listarAgentes(): Promise<AgenteIA[]> {
  return repo.listar();
}

export async function buscarAgente(id: string): Promise<AgenteIA | null> {
  return repo.buscar(id);
}

export async function criarAgente(dados: Omit<AgenteIA, "id">): Promise<AgenteIA> {
  return repo.criar(dados);
}

export async function atualizarAgente(
  id: string,
  dados: Partial<AgenteIA>
): Promise<AgenteIA | null> {
  return repo.atualizar(id, dados);
}

export async function alterarStatusImplantacao(
  id: string,
  statusImplantacao: AgenteIA["statusImplantacao"]
): Promise<AgenteIA | null> {
  return repo.atualizar(id, { statusImplantacao });
}

export async function excluirAgente(id: string): Promise<void> {
  return repo.excluir(id);
}

// ---- Histórico simulado de execuções ----

export async function listarExecucoesDoAgente(
  agenteId: string
): Promise<ExecucaoAgente[]> {
  return repoExecucoes.listar({
    coluna: "agente_id",
    valor: agenteId,
    campoLocal: "agenteId",
  });
}

/** Registra uma execução simulada (o botão "Executar agente" ainda é visual). */
export async function registrarExecucao(agente: AgenteIA): Promise<ExecucaoAgente> {
  return repoExecucoes.criar({
    agenteId: agente.id,
    agente: agente.nome,
    dataHora: new Date().toISOString(),
    contexto: "Execução manual pelo Zion OS",
    resultado: `${agente.saidaEsperada} (execução simulada)`,
  });
}
