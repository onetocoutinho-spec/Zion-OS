// Adaptive Intelligence Layer — ponto de entrada e resolução da implementação.
//
// Factory que devolve a implementação ATIVA do Port DecisionJournal. Em R-DJ-1
// a implementação ativa é o NoOpDecisionJournal (não observa nada ainda).
//
// Trocar a implementação em releases futuras (persistência real) acontece SÓ
// aqui — os eventuais consumidores (R-DJ-2+) dependem do Port, nunca da
// implementação concreta.

import type { DecisionJournal } from "./ports/decision-journal.port.ts";
import { NoOpDecisionJournal } from "./infrastructure/decision-journal.noop.ts";

/** Resolve a implementação ativa do Decision Journal. R-DJ-1: no-op. */
export function resolverDecisionJournal(): DecisionJournal {
  return new NoOpDecisionJournal();
}

export type { DecisionJournal } from "./ports/decision-journal.port.ts";
export type { Decision } from "./domain/decision.ts";
