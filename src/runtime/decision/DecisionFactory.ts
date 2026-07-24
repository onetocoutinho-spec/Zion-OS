// DecisionFactory (ENG-005) — ÚNICA responsável por criar Decision (Lei 15).
// Nenhuma outra classe instancia Decision. Funciona por composição pura + DI
// (relógio e gerador de id injetáveis para testabilidade). Objetos congelados.

import type { Decision, DecisionType, UserIntent } from "../contracts/runtime.ts";
import { DECISION_KIND } from "./Decision.ts";

export class DecisionFactory {
  private seq = 0;

  constructor(
    private readonly now: () => number = Date.now,
    private readonly nextId?: () => string,
  ) {}

  /** Interpreta o UserIntent e produz a Decision imutável correspondente. */
  create(intent: UserIntent): Decision {
    // O Runtime interpreta: cancelar → descartar; responder/confirmar → executar.
    const type: DecisionType = intent.type === "cancel" ? "dismiss" : "execute";
    const id = this.nextId ? this.nextId() : `decision-${++this.seq}`;
    const decision: Decision = {
      kind: DECISION_KIND,
      id,
      type,
      missionId: intent.missionId,
      intentType: intent.type,
      payload: intent.payload,
      timestamp: this.now(),
    };
    return Object.freeze(decision);
  }
}
