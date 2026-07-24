// PendenciasAdapter (PR-1) — a fronteira de integração (Lei 16).
//
// ÚNICO lugar autorizado a tocar a infraestrutura de Pendências existente.
// Reutiliza:
//   • resolverPendencia()  — o serviço REAL (src/lib/services/pendencias.ts),
//     sem wrapper e sem alterar assinatura. É o funil que já persiste a resolução
//     (repo.atualizar { resolvida:true }) e dispara a AIL/Journal (observarResolucao:
//     campo=informacaoPendente, contexto=catalogo, origem=pendencias.resolverPendencia).
//   • DecisionJournal (Port) — injetável em resolverPendencia (Port da AIL existente).
//   • Pendencia           — o tipo de domínio existente.
// Nada é reimplementado.

import type { PendenciaOperation, PendenciasPort } from "./pendencias-contracts.ts";
import type { CapabilityResponse } from "../../runtime/contracts/runtime.ts";
import { pendenciaResolvida, pendenciaFalhou } from "./pendencias-events.ts";
import { resolverPendencia } from "../../lib/services/pendencias.ts";
import type { Pendencia } from "../../lib/types.ts";
import type { DecisionJournal } from "../../modules/adaptive-intelligence/decision-journal.ts";

/** Assinatura REUTILIZADA de resolverPendencia (a real por padrão; DI para teste). */
type ResolverPendencia = (id: string, journal?: DecisionJournal) => Promise<Pendencia | null>;

export class PendenciasAdapter implements PendenciasPort {
  constructor(
    private readonly journal?: DecisionJournal,
    private readonly resolverServico: ResolverPendencia = resolverPendencia,
  ) {}

  async resolver(op: PendenciaOperation): Promise<CapabilityResponse> {
    try {
      // Reutiliza o serviço REAL: aqui a AIL/Journal engajam (fire-and-forget).
      const resultado = await this.resolverServico(op.pendenciaId, this.journal);
      return resultado
        ? pendenciaResolvida({ pendenciaId: resultado.id, resolvida: resultado.resolvida })
        : pendenciaFalhou({ motivo: "pendência inexistente", pendenciaId: op.pendenciaId });
    } catch (erro) {
      return pendenciaFalhou({ motivo: erro instanceof Error ? erro.message : String(erro), pendenciaId: op.pendenciaId });
    }
  }
}
