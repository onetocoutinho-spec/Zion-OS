import { criarRepositorio } from "../repositorio";
import { financeiroParaApp, financeiroParaBanco } from "../supabase/mappers";
import type { FinanceiroRow } from "../supabase/database.types";
import type { RegistroFinanceiro } from "../types";

const repo = criarRepositorio<RegistroFinanceiro, FinanceiroRow>({
  tabela: "financeiro",
  colecao: "financeiro",
  prefixoIdLocal: "fin",
  selecao: "*, clientes(empresa)",
  paraApp: financeiroParaApp,
  paraBanco: financeiroParaBanco,
});

export async function listarFinanceiro(): Promise<RegistroFinanceiro[]> {
  return repo.listar();
}

export async function buscarRegistroFinanceiro(
  id: string
): Promise<RegistroFinanceiro | null> {
  return repo.buscar(id);
}

export async function listarFinanceiroDoCliente(
  clienteId: string
): Promise<RegistroFinanceiro[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarRegistroFinanceiro(
  dados: Omit<RegistroFinanceiro, "id">
): Promise<RegistroFinanceiro> {
  return repo.criar(dados);
}

export async function atualizarRegistroFinanceiro(
  id: string,
  dados: Partial<RegistroFinanceiro>
): Promise<RegistroFinanceiro | null> {
  return repo.atualizar(id, dados);
}

export async function marcarComoPago(id: string): Promise<RegistroFinanceiro | null> {
  return repo.atualizar(id, { statusPagamento: "Pago" });
}

export async function marcarComoAtrasado(id: string): Promise<RegistroFinanceiro | null> {
  return repo.atualizar(id, { statusPagamento: "Atrasado" });
}

export async function excluirRegistroFinanceiro(id: string): Promise<void> {
  return repo.excluir(id);
}
