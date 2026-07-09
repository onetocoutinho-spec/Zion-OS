// Tabelas de medidas gerenciadas pelo cliente (CRUD + import).
//
// Cada cliente cria/edita suas tabelas. Quando a tabela tem `marca`, ela
// aplica a todos os produtos daquela marca (aplicação em massa). O worker e o
// portal carregam essas tabelas e passam para o contexto da IA.

import { criarRepositorio } from "../repositorio";
import { tabelaMedidaParaApp, tabelaMedidaParaBanco } from "../supabase/mappers";
import type { TabelaMedidaRow } from "../supabase/database.types";
import type { TabelaMedida } from "../types";

const repo = criarRepositorio<TabelaMedida, TabelaMedidaRow>({
  tabela: "tabelas_medidas",
  colecao: "tabelasMedidas",
  prefixoIdLocal: "tab",
  selecao: "*",
  paraApp: tabelaMedidaParaApp,
  paraBanco: tabelaMedidaParaBanco,
});

export async function listarTabelasDoCliente(clienteId: string): Promise<TabelaMedida[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarTabelaMedida(dados: Omit<TabelaMedida, "id">): Promise<TabelaMedida> {
  return repo.criar(dados);
}

export async function atualizarTabelaMedida(
  id: string,
  dados: Partial<TabelaMedida>
): Promise<TabelaMedida | null> {
  return repo.atualizar(id, dados);
}

export async function excluirTabelaMedida(id: string): Promise<void> {
  return repo.excluir(id);
}

/** Cria várias tabelas de uma vez (import de planilha / modelos padrão). */
export async function criarTabelasBulk(dados: Omit<TabelaMedida, "id">[]): Promise<TabelaMedida[]> {
  return repo.criarVarios(dados);
}
