import { createItem, getById, listAll, removeItem, updateItem } from "../store";
import type { AgenteIA, ExecucaoAgente } from "../types";

export async function listarAgentes(): Promise<AgenteIA[]> {
  return listAll<AgenteIA>("agentes");
}

export async function buscarAgente(id: string): Promise<AgenteIA | null> {
  return getById<AgenteIA>("agentes", id) ?? null;
}

export async function criarAgente(dados: Omit<AgenteIA, "id">): Promise<AgenteIA> {
  return createItem<AgenteIA>("agentes", dados, "agt");
}

export async function atualizarAgente(
  id: string,
  dados: Partial<AgenteIA>
): Promise<AgenteIA | null> {
  return updateItem<AgenteIA>("agentes", id, dados);
}

export async function alterarStatusImplantacao(
  id: string,
  statusImplantacao: AgenteIA["statusImplantacao"]
): Promise<AgenteIA | null> {
  return updateItem<AgenteIA>("agentes", id, { statusImplantacao });
}

export async function excluirAgente(id: string): Promise<void> {
  removeItem("agentes", id);
}

// ---- Histórico simulado de execuções ----

export async function listarExecucoesDoAgente(
  agenteId: string
): Promise<ExecucaoAgente[]> {
  return listAll<ExecucaoAgente>("execucoes").filter((e) => e.agenteId === agenteId);
}

/** Registra uma execução simulada (o botão "Executar agente" ainda é visual). */
export async function registrarExecucao(agente: AgenteIA): Promise<ExecucaoAgente> {
  return createItem<ExecucaoAgente>(
    "execucoes",
    {
      agenteId: agente.id,
      agente: agente.nome,
      dataHora: new Date().toISOString(),
      contexto: "Execução manual pelo Zion OS",
      resultado: `${agente.saidaEsperada} (execução simulada)`,
    },
    "exe"
  );
}
