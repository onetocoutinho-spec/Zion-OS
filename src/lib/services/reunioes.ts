import { criarRepositorio } from "../repositorio";
import { reuniaoParaApp, reuniaoParaBanco } from "../supabase/mappers";
import type { ReuniaoRow } from "../supabase/database.types";
import type { Reuniao, ReuniaoStatus } from "../types";

const repo = criarRepositorio<Reuniao, ReuniaoRow>({
  tabela: "reunioes",
  colecao: "reunioes",
  prefixoIdLocal: "reu",
  selecao: "*, clientes(empresa)",
  paraApp: reuniaoParaApp,
  paraBanco: reuniaoParaBanco,
  ordenarPor: "data_hora",
});

export async function listarReunioes(): Promise<Reuniao[]> {
  return repo.listar();
}

export async function buscarReuniao(id: string): Promise<Reuniao | null> {
  return repo.buscar(id);
}

export async function listarReunioesDoCliente(clienteId: string): Promise<Reuniao[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarReuniao(dados: Omit<Reuniao, "id">): Promise<Reuniao> {
  return repo.criar(dados);
}

export async function atualizarReuniao(
  id: string,
  dados: Partial<Reuniao>
): Promise<Reuniao | null> {
  return repo.atualizar(id, dados);
}

export async function alterarStatusReuniao(
  id: string,
  status: ReuniaoStatus
): Promise<Reuniao | null> {
  return repo.atualizar(id, { status });
}

export async function excluirReuniao(id: string): Promise<void> {
  return repo.excluir(id);
}
