import { criarRepositorio } from "../repositorio";
import { pendenciaParaApp, pendenciaParaBanco } from "../supabase/mappers";
import type { PendenciaRow } from "../supabase/database.types";
import type { Pendencia } from "../types";
import {
  resolverDecisionJournal,
  type DecisionJournal,
} from "../../modules/adaptive-intelligence/decision-journal.ts";

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

export async function resolverPendencia(
  id: string,
  journal: DecisionJournal = resolverDecisionJournal(),
): Promise<Pendencia | null> {
  const resultado = await repo.atualizar(id, { resolvida: true });
  if (resultado) observarResolucao(resultado, journal);
  return resultado;
}

// ── Observador lateral · Adaptive Intelligence Layer (R-DJ-2) ────────────────
// Registra a resolução de uma pendência como uma Decision no Decision Journal.
// É estritamente fire-and-forget: roda DEPOIS da persistência bem-sucedida,
// nunca altera o valor de retorno e — pelo contrato do Port e pelo try/catch
// abaixo — nunca propaga exceção. Em R-DJ-2 a implementação ativa (via Factory)
// é o NoOpDecisionJournal, que descarta tudo: nenhum comportamento observável.
//
// Campos ainda não disponíveis nesta camada permanecem vazios de forma
// deliberada: `autor` (não há usuário autenticado no serviço) e `correlacao`.
// `valorAnterior` representa a transição canônica da resolução (false→true) —
// capturar o estado real anterior exigiria uma leitura extra, acoplamento que
// R-DJ-2 evita de propósito.
//
// Rollback trivial: remover este bloco, o parâmetro `journal` e o import da AIL
// devolve resolverPendencia ao corpo de uma linha anterior, sem resíduo.
function observarResolucao(pendencia: Pendencia, journal: DecisionJournal): void {
  try {
    journal.registrarDecisao({
      id: crypto.randomUUID(),
      empresa: pendencia.clienteId,
      autor: "",
      contexto: "pendencia",
      entidade: { tipo: "pendencia", id: pendencia.id },
      campo: "resolvida",
      valorAnterior: "false",
      valorNovo: "true",
      origem: "pendencias.resolverPendencia",
      timestamp: new Date().toISOString(),
      correlacao: null,
    });
  } catch {
    // Falha interna do Journal NUNCA afeta a resolução da pendência.
  }
}

export async function reabrirPendencia(id: string): Promise<Pendencia | null> {
  return repo.atualizar(id, { resolvida: false });
}

export async function excluirPendencia(id: string): Promise<void> {
  return repo.excluir(id);
}
