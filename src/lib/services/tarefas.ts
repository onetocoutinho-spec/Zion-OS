import { criarRepositorio } from "../repositorio";
import { tarefaParaApp, tarefaParaBanco } from "../supabase/mappers";
import type { TarefaRow } from "../supabase/database.types";
import type { Tarefa } from "../types";

const repo = criarRepositorio<Tarefa, TarefaRow>({
  tabela: "tarefas",
  colecao: "tarefas",
  prefixoIdLocal: "tar",
  selecao:
    "*, clientes(empresa), produtos(nome), anuncios(produtos(nome)), agentes(nome)",
  paraApp: tarefaParaApp,
  paraBanco: tarefaParaBanco,
});

export async function listarTarefas(): Promise<Tarefa[]> {
  return repo.listar();
}

export async function buscarTarefa(id: string): Promise<Tarefa | null> {
  return repo.buscar(id);
}

export async function listarTarefasDoCliente(clienteId: string): Promise<Tarefa[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function listarTarefasDoProduto(produtoId: string): Promise<Tarefa[]> {
  return repo.listar({ coluna: "produto_id", valor: produtoId, campoLocal: "produtoId" });
}

export async function listarTarefasDoAnuncio(anuncioId: string): Promise<Tarefa[]> {
  return repo.listar({ coluna: "anuncio_id", valor: anuncioId, campoLocal: "anuncioId" });
}

export async function criarTarefa(dados: Omit<Tarefa, "id">): Promise<Tarefa> {
  return repo.criar(dados);
}

export async function atualizarTarefa(
  id: string,
  dados: Partial<Tarefa>
): Promise<Tarefa | null> {
  return repo.atualizar(id, dados);
}

export async function concluirTarefa(id: string): Promise<Tarefa | null> {
  return repo.atualizar(id, { status: "Concluído" });
}

export async function excluirTarefa(id: string): Promise<void> {
  return repo.excluir(id);
}
