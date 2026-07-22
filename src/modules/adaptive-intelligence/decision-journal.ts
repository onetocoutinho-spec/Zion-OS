// Adaptive Intelligence Layer — ponto de entrada e resolução da implementação.
//
// Factory que devolve a implementação ATIVA do Port DecisionJournal. Desde
// R-DJ-3 a implementação ativa é o RepositoryDecisionJournal (persistência real
// via Repository.salvar(), preservando o DecisionId do domínio — R-INF-001).
//
// A troca acontece SÓ aqui — os consumidores (Producers) dependem do Port,
// nunca da implementação concreta; nenhum Producer percebe a mudança.
// O NoOpDecisionJournal permanece no módulo para rollback e testes.

import type { Decision } from "./domain/decision.ts";
import type { DecisionJournal } from "./ports/decision-journal.port.ts";
import { RepositoryDecisionJournal } from "./infrastructure/decision-journal.repository.ts";

/** Resolve a implementação ativa do Decision Journal. R-DJ-3: persistente. */
export function resolverDecisionJournal(): DecisionJournal {
  return new RepositoryDecisionJournal();
}

/** O que uma Signal Source conhece no momento da decisão (PR-004). */
export interface CapturaDeDecisao {
  empresa: string;
  contexto: string;
  entidade: Decision["entidade"];
  campo: string;
  valorAnterior: string | null;
  valorNovo: string;
  origem: string;
  autor?: string;
  correlacao?: string | null;
}

/**
 * Captura uma decisão na FONTE do sinal (Signal Source).
 *
 * Duas camadas, dois verbos (linguagem ubíqua): a fonte CAPTURA um parcial;
 * o Journal REGISTRA a Decision completa.
 *
 *   Signal Source → capturarDecisao() → registrarDecisao() (Port) → persistência
 *
 * Responsabilidades: completa o que a fonte não conhece (id, timestamp,
 * defaults) e aplica o PRINCÍPIO DA CAPTURA SIGNIFICATIVA na fronteira:
 *   - sem delta real (anterior === novo) → não captura;
 *   - valorNovo vazio/só espaços → não captura (nada aprendível).
 * (O Detector reaplica a elegibilidade completa na forma canônica.)
 *
 * NUNCA falha e NUNCA afeta o fluxo de negócio (fire-and-forget absoluto).
 */
export function capturarDecisao(
  captura: CapturaDeDecisao,
  journal: DecisionJournal = resolverDecisionJournal()
): void {
  try {
    if (!captura.valorNovo || !captura.valorNovo.trim()) return;
    if (captura.valorAnterior === captura.valorNovo) return;
    journal.registrarDecisao({
      id: crypto.randomUUID(),
      empresa: captura.empresa,
      autor: captura.autor ?? "",
      contexto: captura.contexto,
      entidade: captura.entidade,
      campo: captura.campo,
      valorAnterior: captura.valorAnterior,
      valorNovo: captura.valorNovo,
      origem: captura.origem,
      timestamp: new Date().toISOString(),
      correlacao: captura.correlacao ?? null,
    });
  } catch {
    // fire-and-forget: a captura jamais afeta o fluxo de negócio.
  }
}

export type { DecisionJournal } from "./ports/decision-journal.port.ts";
export type { Decision } from "./domain/decision.ts";
