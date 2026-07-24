// CatalogCapability (ENG-006) — a primeira Capability real da Zion.
//
// Recebe a Decision (via o CapabilityRequest do Runtime, inalterado — ENG-005),
// traduz para uma OPERAÇÃO DE CATÁLOGO e delega à porta de saída (o Adapter).
// NUNCA conhece Mission, Shell, React ou Design System. Só contratos do Runtime
// e a sua própria porta. Toda integração externa mora no Adapter (Lei 16).

import type { CapabilityPort } from "../../runtime/ports/CapabilityPort.ts";
import type { CapabilityRequest, CapabilityResponse } from "../../runtime/contracts/runtime.ts";
import { catalogFailed } from "./catalog-events.ts";

/** A operação de catálogo que uma Decision representa. Campo já observado pela AIL. */
export interface CatalogOperation {
  readonly campo: "categoriaMarketplace";
  readonly valor: string;
}

/** Porta de SAÍDA da Capability para a infraestrutura de catálogo (Lei 16). */
export interface CatalogPort {
  apply(op: CatalogOperation): Promise<CapabilityResponse>;
}

/** Missão → campo de catálogo. Só fluxos já suportados pela AIL entram aqui. */
const CAMPO_POR_MISSAO: Record<string, CatalogOperation["campo"]> = {
  "categoria-marketplace": "categoriaMarketplace",
};

export class CatalogCapability implements CapabilityPort {
  constructor(private readonly catalog: CatalogPort) {}

  async execute(request: CapabilityRequest): Promise<CapabilityResponse> {
    const campo = CAMPO_POR_MISSAO[request.missionId];
    if (!campo) return catalogFailed({ motivo: "missão não mapeada a operação de catálogo", missionId: request.missionId });

    const valor = typeof request.payload === "string" ? request.payload.trim() : "";
    if (!valor) return catalogFailed({ motivo: "valor de catálogo vazio" });

    return this.catalog.apply({ campo, valor });
  }
}
