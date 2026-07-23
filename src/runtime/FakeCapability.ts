// FakeCapability (ENG-005) — a ÚNICA Capability desta etapa: um stand-in.
// Recebe a Decision (via CapabilityRequest) e responde { status: "completed" }.
// Nenhuma IA, nenhum domínio, nenhuma persistência. Será substituída por
// Capabilities reais na Etapa 7 (Catalog Capability).

import type { CapabilityPort } from "./ports/CapabilityPort.ts";
import type { CapabilityRequest, CapabilityResponse } from "./contracts/runtime.ts";

export class FakeCapability implements CapabilityPort {
  execute(_request: CapabilityRequest): CapabilityResponse {
    return { status: "completed" };
  }
}
