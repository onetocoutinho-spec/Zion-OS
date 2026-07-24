// Contratos do Runtime (ENG-005) — SÓ interfaces. Nenhuma implementação.
// O Runtime conhece APENAS contratos: nada de React, componentes, CSS, Design
// System, Mission ou Shell. Toda comunicação com a interface é por portas.
//
// Lei 15: só o Runtime produz Decisions. Lei 14: o Runtime nunca conhece
// componentes — toda comunicação com a interface ocorre por portas.

// ── Entrada de fronteira ─────────────────────────────────────────────────────
// UserIntent é a saída da interface (ENG-004). O Runtime define AQUI a sua visão
// de fronteira, estruturalmente idêntica — sem importar Mission (Ports & Adapters).
export type UserIntentType = "answer" | "confirm" | "cancel";
export interface UserIntent {
  readonly missionId: string;
  readonly type: UserIntentType;
  readonly payload: unknown;
  readonly timestamp: number;
}

// ── Decision ─────────────────────────────────────────────────────────────────
/** O Runtime decide EXECUTAR a intenção ou DESCARTÁ-la (cancelamento). */
export type DecisionType = "execute" | "dismiss";

/** Objeto imutável; representa exclusivamente a decisão do Runtime. Sem domínio. */
export interface Decision {
  readonly kind: "decision"; // marca de autenticidade (só a DecisionFactory a produz)
  readonly id: string;
  readonly type: DecisionType;
  readonly missionId: string;
  readonly intentType: UserIntentType;
  readonly payload: unknown;
  readonly timestamp: number;
}

// ── Capability (contratos de despacho) ───────────────────────────────────────
export interface CapabilityRequest {
  readonly decisionId: string;
  readonly missionId: string;
  readonly payload: unknown;
}
export interface CapabilityResponse {
  readonly status: "completed" | "failed";
  readonly detail?: unknown;
}

// ── Runtime Events ───────────────────────────────────────────────────────────
export type RuntimeEventType =
  | "DecisionCreated"
  | "CapabilityRequested"
  | "CapabilityCompleted"
  | "CapabilityFailed";

export interface RuntimeEvent {
  readonly type: RuntimeEventType;
  readonly timestamp: number;
  readonly decisionId?: string;
  readonly missionId?: string;
  readonly decision?: Decision;
  readonly request?: CapabilityRequest;
  readonly response?: CapabilityResponse;
}

// ── Runtime ──────────────────────────────────────────────────────────────────
/** Recebe UserIntent, produz Decision, despacha Capability, publica eventos. */
export interface Runtime {
  receive(intent: UserIntent): void;
}
