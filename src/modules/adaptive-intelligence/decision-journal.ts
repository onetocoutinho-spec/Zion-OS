// Adaptive Intelligence Layer — ponto de entrada e resolução da implementação.
//
// Factory que devolve a implementação ATIVA do Port DecisionJournal. Desde
// R-DJ-3 a implementação ativa é o RepositoryDecisionJournal (persistência real
// via Repository.salvar(), preservando o DecisionId do domínio — R-INF-001).
//
// A troca acontece SÓ aqui — os consumidores (Producers) dependem do Port,
// nunca da implementação concreta; nenhum Producer percebe a mudança.
// O NoOpDecisionJournal permanece no módulo para rollback e testes.

import type { DecisionJournal } from "./ports/decision-journal.port.ts";
import { RepositoryDecisionJournal } from "./infrastructure/decision-journal.repository.ts";

/** Resolve a implementação ativa do Decision Journal. R-DJ-3: persistente. */
export function resolverDecisionJournal(): DecisionJournal {
  return new RepositoryDecisionJournal();
}

export type { DecisionJournal } from "./ports/decision-journal.port.ts";
export type { Decision } from "./domain/decision.ts";
