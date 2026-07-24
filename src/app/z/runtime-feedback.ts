// Tradução RuntimeEvent → FeedbackState (ENG-007) — glue do composition root.
//
// O Runtime publica APENAS RuntimeEvents (nunca conhece React/Shell). O Shell
// só entende o seu FeedbackState. Este mapeador — que vive no composition root,
// não no Runtime nem no Shell — faz a ponte, exatamente conforme a Constituição:
//   DecisionCreated      → loading
//   CapabilityRequested  → running
//   CapabilityCompleted  → completed (success)
//   CapabilityFailed     → error
// Nenhuma outra interpretação.

import type { RuntimeEvent } from "../../runtime/contracts/runtime.ts";
import type { FeedbackState } from "../../shell/contracts/shell.ts";

export function mapRuntimeEventToFeedback(event: RuntimeEvent): FeedbackState {
  switch (event.type) {
    case "DecisionCreated":
      return { kind: "loading" };
    case "CapabilityRequested":
      return { kind: "running" };
    case "CapabilityCompleted":
      return { kind: "completed" };
    case "CapabilityFailed": {
      const detail = event.response?.detail;
      const motivo =
        detail && typeof detail === "object" && "motivo" in detail
          ? String((detail as { motivo: unknown }).motivo)
          : undefined;
      return { kind: "error", message: motivo };
    }
  }
}
