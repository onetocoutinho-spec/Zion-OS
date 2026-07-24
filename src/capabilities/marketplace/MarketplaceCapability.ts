// MarketplaceCapability (CAP-002) — a primeira Capability de negócio Marketplace.
//
// Recebe a Decision (via o CapabilityRequest do Runtime, inalterado — ENG-005),
// traduz para uma OPERAÇÃO DE MARKETPLACE e delega à porta de saída (o Adapter).
// NUNCA conhece Runtime, React, Mission ou Shell — só o contrato do Runtime e a
// sua própria porta. Toda integração externa mora no Adapter (Lei 16).

import type { CapabilityPort } from "../../runtime/ports/CapabilityPort.ts";
import type { CapabilityRequest, CapabilityResponse } from "../../runtime/contracts/runtime.ts";
import type { MarketplaceOperation, MarketplacePort } from "./marketplace-contracts.ts";
import { marketplaceFailed } from "./marketplace-events.ts";

/** Missão → campo de Marketplace. Só fluxos já suportados pela AIL entram aqui. */
const CAMPO_POR_MISSAO: Record<string, MarketplaceOperation["campo"]> = {
  "tipo-anuncio": "tipoAnuncio",
};

export class MarketplaceCapability implements CapabilityPort {
  constructor(private readonly marketplace: MarketplacePort) {}

  async execute(request: CapabilityRequest): Promise<CapabilityResponse> {
    const campo = CAMPO_POR_MISSAO[request.missionId];
    if (!campo) return marketplaceFailed({ motivo: "missão não mapeada a operação de marketplace", missionId: request.missionId });

    const valor = typeof request.payload === "string" ? request.payload.trim() : "";
    if (!valor) return marketplaceFailed({ motivo: "valor de marketplace vazio" });

    return this.marketplace.apply({ campo, valor });
  }
}
