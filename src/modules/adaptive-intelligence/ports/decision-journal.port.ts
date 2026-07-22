// DecisionJournal — o Port de observação da Adaptive Intelligence Layer.
//
// Contrato definido em RFC-AIL-001 (Decision Journal) e ARQ-003 §3.1.
// É um OBSERVADOR LATERAL: os contextos registram decisões e NÃO esperam
// resposta. A operação é FIRE-AND-FORGET — retorna void, nunca lança, e a
// correção do cliente jamais depende dela para ter sucesso.
//
// Nesta Release (R-DJ-1) o Port apenas EXISTE — nenhum contexto o chama.

import type { Decision } from "../domain/decision.ts";

/**
 * Registra uma decisão observada. Fire-and-forget:
 *   - retorna imediatamente (void);
 *   - NUNCA lança — qualquer falha interna é engolida pela implementação;
 *   - se a AIL não existir, é um no-op.
 */
export interface DecisionJournal {
  registrarDecisao(decisao: Decision): void;
}
