// pendencias-events (PR-1) — mapeia o RESULTADO da operação de Pendência ao
// contrato de evento JÁ EXISTENTE do Runtime (CapabilityResponse, ENG-005).
//
// Nenhum evento novo, nenhum barramento novo: o RuntimeDispatcher os converte nos
// RuntimeEvents existentes (CapabilityCompleted / CapabilityFailed). E, dentro de
// resolverPendencia(), o evento de decisão da AIL (capturarDecisao) — também
// existente — registra a resolução no Journal.

import type { CapabilityResponse } from "../../runtime/contracts/runtime.ts";

export const pendenciaResolvida = (detail?: unknown): CapabilityResponse => ({ status: "completed", detail });
export const pendenciaFalhou = (detail?: unknown): CapabilityResponse => ({ status: "failed", detail });
