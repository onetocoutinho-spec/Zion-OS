import { criarRepositorio } from "../repositorio";
import { execucaoLoteParaApp, execucaoLoteParaBanco } from "../supabase/mappers";
import type { ExecucaoLoteRow } from "../supabase/database.types";
import type { ExecucaoLote } from "../types";

const repo = criarRepositorio<ExecucaoLote, ExecucaoLoteRow>({
  tabela: "execucoes_lote",
  colecao: "execucoesLote",
  prefixoIdLocal: "exl",
  selecao: "*, clientes(empresa), agentes(nome)",
  paraApp: execucaoLoteParaApp,
  paraBanco: execucaoLoteParaBanco,
});

export async function listarExecucoesLote(): Promise<ExecucaoLote[]> {
  return repo.listar();
}

export async function listarExecucoesLoteDoCliente(
  clienteId: string
): Promise<ExecucaoLote[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarExecucaoLote(
  dados: Omit<ExecucaoLote, "id">
): Promise<ExecucaoLote> {
  return repo.criar(dados);
}

export async function atualizarExecucaoLote(
  id: string,
  dados: Partial<ExecucaoLote>
): Promise<ExecucaoLote | null> {
  return repo.atualizar(id, dados);
}
