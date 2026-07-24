// marketplace-events (CAP-002) — mapeia o RESULTADO da operação de Marketplace
// ao contrato de evento JÁ EXISTENTE do Runtime (CapabilityResponse, ENG-005).
//
// Nenhum evento novo, nenhum barramento novo: o RuntimeDispatcher os converte nos
// RuntimeEvents existentes (CapabilityCompleted / CapabilityFailed). E, dentro de
// salvarCanal(), o evento de decisão da AIL (capturarDecisao) — também existente —
// registra a escolha no Journal.

import type { CapabilityResponse } from "../../runtime/contracts/runtime.ts";

export const marketplaceCompleted = (detail?: unknown): CapabilityResponse => ({ status: "completed", detail });
export const marketplaceFailed = (detail?: unknown): CapabilityResponse => ({ status: "failed", detail });
