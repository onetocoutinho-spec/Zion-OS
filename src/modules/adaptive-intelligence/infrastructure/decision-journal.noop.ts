// NoOpDecisionJournal — implementação nula do Port DecisionJournal.
//
// É a implementação ATIVA em R-DJ-1: recebe a decisão e a descarta. Não
// persiste, não emite evento, não faz I/O. Existe para que o contrato do Port
// seja satisfeito sem que nenhum comportamento seja produzido.
//
// Garante o invariante central (RFC-AIL-001 §6.2): registrarDecisao NUNCA lança.

import type { DecisionJournal } from "../ports/decision-journal.port.ts";
import type { Decision } from "../domain/decision.ts";

/** Descarta silenciosamente toda decisão. Nunca lança. */
export class NoOpDecisionJournal implements DecisionJournal {
  registrarDecisao(_decisao: Decision): void {
    // Intencionalmente vazio — observador nulo (R-DJ-1).
  }
}
