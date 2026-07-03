import { criarRepositorio } from "../repositorio";
import { relatorioParaApp, relatorioParaBanco } from "../supabase/mappers";
import type { RelatorioRow } from "../supabase/database.types";
import type { Relatorio } from "../types";

const repo = criarRepositorio<Relatorio, RelatorioRow>({
  tabela: "relatorios",
  colecao: "relatorios",
  prefixoIdLocal: "rel",
  selecao: "*, clientes(empresa)",
  paraApp: relatorioParaApp,
  paraBanco: relatorioParaBanco,
});

export async function listarRelatorios(): Promise<Relatorio[]> {
  return repo.listar();
}

export async function buscarRelatorio(id: string): Promise<Relatorio | null> {
  return repo.buscar(id);
}

export async function listarRelatoriosDoCliente(clienteId: string): Promise<Relatorio[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarRelatorio(dados: Omit<Relatorio, "id">): Promise<Relatorio> {
  return repo.criar(dados);
}

export async function atualizarRelatorio(
  id: string,
  dados: Partial<Relatorio>
): Promise<Relatorio | null> {
  return repo.atualizar(id, dados);
}

export async function excluirRelatorio(id: string): Promise<void> {
  return repo.excluir(id);
}
