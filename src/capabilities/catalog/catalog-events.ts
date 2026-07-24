// catalog-events (ENG-006) — mapeia o RESULTADO da operação de catálogo para o
// contrato de evento JÁ EXISTENTE do Runtime (CapabilityResponse, ENG-005).
//
// Nenhum evento novo é inventado: o RuntimeDispatcher converte estes resultados
// nos RuntimeEvents existentes (CapabilityCompleted / CapabilityFailed). E, dentro
// de atualizarProduto(), o evento de decisão da AIL (capturarDecisao) — também
// existente — é quem registra a decisão no Journal.

import type { CapabilityResponse } from "../../runtime/contracts/runtime.ts";

export const catalogCompleted = (detail?: unknown): CapabilityResponse => ({ status: "completed", detail });
export const catalogFailed = (detail?: unknown): CapabilityResponse => ({ status: "failed", detail });
