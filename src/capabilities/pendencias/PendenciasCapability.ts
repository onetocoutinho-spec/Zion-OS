// PendenciasCapability (PR-1) — a terceira Capability de negócio.
//
// Recebe a Decision (via o CapabilityRequest do Runtime, inalterado — ENG-005),
// traduz para uma OPERAÇÃO DE PENDÊNCIA e delega à porta de saída (o Adapter).
// NUNCA conhece Runtime, React, Mission ou Shell — só o contrato do Runtime e a
// sua própria porta. Toda integração externa mora no Adapter (Lei 16).

import type { CapabilityPort } from "../../runtime/ports/CapabilityPort.ts";
import type { CapabilityRequest, CapabilityResponse } from "../../runtime/contracts/runtime.ts";
import type { PendenciaOperation, PendenciasPort } from "./pendencias-contracts.ts";
import { pendenciaFalhou } from "./pendencias-events.ts";

/** Missão → ação de Pendência. Só fluxos já suportados pela AIL entram aqui. */
const ACAO_POR_MISSAO: Record<string, PendenciaOperation["acao"]> = {
  "resolver-pendencia": "resolver",
};

export class PendenciasCapability implements CapabilityPort {
  constructor(private readonly pendencias: PendenciasPort) {}

  async execute(request: CapabilityRequest): Promise<CapabilityResponse> {
    const acao = ACAO_POR_MISSAO[request.missionId];
    if (!acao) return pendenciaFalhou({ motivo: "missão não mapeada a operação de pendência", missionId: request.missionId });

    const pendenciaId = typeof request.payload === "string" ? request.payload.trim() : "";
    if (!pendenciaId) return pendenciaFalhou({ motivo: "pendenciaId vazio" });

    return this.pendencias.resolver({ acao, pendenciaId });
  }
}
