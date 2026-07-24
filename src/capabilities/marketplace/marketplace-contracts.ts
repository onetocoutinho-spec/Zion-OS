// Contratos da MarketplaceCapability (CAP-002) — SÓ interfaces. Nenhuma
// implementação. A Capability traduz uma Decision numa operação de Marketplace e
// delega à porta de saída (o Adapter). Nada aqui conhece Runtime, React, Mission
// ou Shell — só o contrato de resposta do Runtime (reutilizado).

import type { CapabilityResponse } from "../../runtime/contracts/runtime.ts";

/** A operação de Marketplace que uma Decision representa. O campo `tipoAnuncio`
 *  é uma decisão de Publicação JÁ OBSERVADA pela AIL (canaisMarketplace). */
export interface MarketplaceOperation {
  readonly campo: "tipoAnuncio";
  readonly valor: string; // ex.: "Classic" | "Premium" — a Capability não valida domínio
}

/** Porta de SAÍDA da Capability para a infraestrutura de Marketplace (Lei 16). */
export interface MarketplacePort {
  apply(op: MarketplaceOperation): Promise<CapabilityResponse>;
}
