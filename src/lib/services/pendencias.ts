import { criarRepositorio } from "../repositorio";
import { pendenciaParaApp, pendenciaParaBanco } from "../supabase/mappers";
import type { PendenciaRow } from "../supabase/database.types";
import type { Pendencia } from "../types";

const repo = criarRepositorio<Pendencia, PendenciaRow>({
  tabela: "pendencias",
  colecao: "pendencias",
  prefixoIdLocal: "pen",
  selecao: "*, clientes(empresa), tarefas(tarefa)",
  paraApp: pendenciaParaApp,
  paraBanco: pendenciaParaBanco,
});

export async function listarPendencias(): Promise<Pendencia[]> {
  return repo.listar();
}

export async function buscarPendencia(id: string): Promise<Pendencia | null> {
  return repo.buscar(id);
}

export async function listarPendenciasDoCliente(clienteId: string): Promise<Pendencia[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarPendencia(dados: Omit<Pendencia, "id">): Promise<Pendencia> {
  return repo.criar(dados);
}

export async function atualizarPendencia(
  id: string,
  dados: Partial<Pendencia>
): Promise<Pendencia | null> {
  return repo.atualizar(id, dados);
}

export async function resolverPendencia(id: string): Promise<Pendencia | null> {
  return repo.atualizar(id, { resolvida: true });
}

export async function reabrirPendencia(id: string): Promise<Pendencia | null> {
  return repo.atualizar(id, { resolvida: false });
}

export async function excluirPendencia(id: string): Promise<void> {
  return repo.excluir(id);
}
