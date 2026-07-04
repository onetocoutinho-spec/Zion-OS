import { criarRepositorio } from "../repositorio";
import { filaParaApp, filaParaBanco } from "../supabase/mappers";
import type { FilaOtimizacaoRow } from "../supabase/database.types";
import type { AuditoriaAnuncio, ItemFilaOtimizacao, StatusFila, TipoAcaoFila } from "../types";

const repo = criarRepositorio<ItemFilaOtimizacao, FilaOtimizacaoRow>({
  tabela: "fila_otimizacao",
  colecao: "filaOtimizacao",
  prefixoIdLocal: "fila",
  selecao: "*, clientes(empresa), auditorias_anuncios(titulo_atual)",
  paraApp: filaParaApp,
  paraBanco: filaParaBanco,
});

export async function listarFila(): Promise<ItemFilaOtimizacao[]> {
  return repo.listar();
}

export async function listarFilaDoCliente(clienteId: string): Promise<ItemFilaOtimizacao[]> {
  return repo.listar({ coluna: "cliente_id", valor: clienteId, campoLocal: "clienteId" });
}

export async function criarItemFila(
  dados: Omit<ItemFilaOtimizacao, "id">
): Promise<ItemFilaOtimizacao> {
  return repo.criar(dados);
}

export async function atualizarItemFila(
  id: string,
  dados: Partial<ItemFilaOtimizacao>
): Promise<ItemFilaOtimizacao | null> {
  return repo.atualizar(id, dados);
}

export async function alterarStatusFila(
  id: string,
  status: StatusFila
): Promise<ItemFilaOtimizacao | null> {
  return repo.atualizar(id, { status });
}

export async function excluirItemFila(id: string): Promise<void> {
  return repo.excluir(id);
}

/** Cria um item de fila a partir de uma auditoria (botão "Enviar para a fila"). */
export async function enviarAuditoriaParaFila(
  a: AuditoriaAnuncio,
  tipoAcao: TipoAcaoFila = "otimizar_completo"
): Promise<ItemFilaOtimizacao> {
  return repo.criar({
    clienteId: a.clienteId,
    cliente: a.cliente,
    auditoriaId: a.id,
    anuncioId: a.anuncioId,
    prioridade: a.prioridade,
    tipoAcao,
    agenteResponsavel: a.agenteRecomendado,
    responsavelHumano: a.responsavel,
    status: "pendente",
    prazo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    resultadoEsperado: a.proximaAcao,
    observacoes: "",
    tituloAnuncio: a.tituloAtual,
  });
}
