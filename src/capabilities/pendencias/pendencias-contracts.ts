// Contratos da PendenciasCapability (PR-1, 3ª Capability) — SÓ interfaces.
// A Capability traduz uma Decision numa operação de Pendência e delega à porta de
// saída (o Adapter). Nada aqui conhece Runtime, React, Mission ou Shell — só o
// contrato de resposta do Runtime (reutilizado).

import type { CapabilityResponse } from "../../runtime/contracts/runtime.ts";

/** A operação de Pendência que uma Decision representa. Resolver = "a informação
 *  pendente do catálogo foi fornecida" (decisão JÁ observada pela AIL —
 *  pendencias.resolverPendencia, contexto catalogo, campo informacaoPendente). */
export interface PendenciaOperation {
  readonly acao: "resolver";
  readonly pendenciaId: string;
}

/** Porta de SAÍDA da Capability para a infraestrutura de Pendências (Lei 16). */
export interface PendenciasPort {
  resolver(op: PendenciaOperation): Promise<CapabilityResponse>;
}
