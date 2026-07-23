// CapabilityPort (ENG-005) — porta de SAÍDA para execução. Interface apenas,
// sem implementação. O Dispatcher despacha por esta porta e nunca conhece a
// Capability concreta.

import type { CapabilityRequest, CapabilityResponse } from "../contracts/runtime.ts";

export interface CapabilityPort {
  execute(request: CapabilityRequest): CapabilityResponse | Promise<CapabilityResponse>;
}
