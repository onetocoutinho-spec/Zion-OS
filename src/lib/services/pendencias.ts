import { criarRepositorio } from "../repositorio";
import { pendenciaParaApp, pendenciaParaBanco } from "../supabase/mappers";
import type { PendenciaRow } from "../supabase/database.types";
import type { Pendencia } from "../types";
import {
  capturarDecisao,
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

// ── Observador lateral · Adaptive Intelligence Layer (R-DJ-2 · canônico em R-DJ-3) ──
// Registra a resolução de uma pendência como uma Decision CANÔNICA no Decision
// Journal. O evento de negócio é "o cliente forneceu a informação pendente do
// catálogo" (RFC-AIL-001 §4.1) — não o toggle técnico `resolvida`:
//   contexto      = "catalogo"           Bounded Context canônico (RFC-AIL-003 §5.2)
//   campo         = "informacaoPendente" assunto substantivo decidido
//   valorNovo     = pendencia.descricao  a necessidade de informação atendida —
//                   melhor identificador do domínio (não há código/slug/enum)
//   valorAnterior = null                 a informação estava AUSENTE (null→valor)
// Pattern Key resultante: (empresa, "catalogo", "informacaoPendente", ⟨descricao⟩)
// — estável e imediatamente compatível com o Pattern Detector (RFC-AIL-004).
//
// Guarda de elegibilidade (RFC-AIL-003 §4.4/§5.3): descrição vazia ou só espaços
// não emite — um valorNovo sem conteúdo não forma padrão. A resolução em si
// NUNCA é afetada pela guarda.
//
// É estritamente fire-and-forget: roda DEPOIS da persistência bem-sucedida,
// nunca altera o valor de retorno e nunca propaga exceção. Campos indisponíveis
// nesta camada permanecem vazios de forma deliberada: `autor` e `correlacao`.
//
// Rollback trivial: remover este bloco, o parâmetro `journal` e o import da AIL
// devolve resolverPendencia ao corpo de uma linha anterior, sem resíduo.
function observarResolucao(pendencia: Pendencia, journal: DecisionJournal): void {
  // capturarDecisao aplica as guardas de captura significativa (valor vazio,
  // sem delta) e o fire-and-forget — a resolução jamais é afetada.
  capturarDecisao(
    {
      empresa: pendencia.clienteId,
      contexto: "catalogo",
      entidade: { tipo: "pendencia", id: pendencia.id },
      campo: "informacaoPendente",
      valorAnterior: null,
      valorNovo: pendencia.descricao,
      origem: "pendencias.resolverPendencia",
    },
    journal
  );
}

export async function reabrirPendencia(id: string): Promise<Pendencia | null> {
  return repo.atualizar(id, { resolvida: false });
}

export async function excluirPendencia(id: string): Promise<void> {
  return repo.excluir(id);
}
