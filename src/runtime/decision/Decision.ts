// Decision (ENG-005) — objeto imutável. Representa exclusivamente a decisão do
// Runtime; nunca conhece domínio. Este módulo guarda a MARCA de autenticidade e
// o guarda de tipo. A construção é responsabilidade EXCLUSIVA da DecisionFactory.

import type { Decision } from "../contracts/runtime.ts";

export type { Decision };

/** Marca que só a DecisionFactory estampa — evidencia a origem única. */
export const DECISION_KIND = "decision" as const;

/** Uma Decision autêntica: marcada pela factory E congelada (imutável). */
export function isDecision(value: unknown): value is Decision {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { kind?: unknown }).kind === DECISION_KIND &&
    Object.isFrozen(value)
  );
}
