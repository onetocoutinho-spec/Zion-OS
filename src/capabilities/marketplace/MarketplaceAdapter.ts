// MarketplaceAdapter (CAP-002) — a fronteira de integração (Lei 16).
//
// ÚNICO lugar autorizado a tocar a infraestrutura de Marketplace existente.
// Reutiliza:
//   • salvarCanal()             — o serviço REAL (src/lib/services/canaisMarketplace.ts),
//     sem wrapper e sem alterar assinatura. É o funil que já dispara a AIL/Journal
//     (capturarDecisao para o campo observado tipoAnuncio, contexto "publicacao").
//   • DecisionJournal (Port)    — injetável em salvarCanal (Port da AIL existente).
//   • CanalMarketplace          — o tipo de domínio existente.
// Nada é reimplementado. Observação: salvarCanal é Supabase-only (sem fallback
// local); sem integração ativa ele devolve null → esta operação vira failed.

import type { MarketplaceOperation, MarketplacePort } from "./marketplace-contracts.ts";
import type { CapabilityResponse } from "../../runtime/contracts/runtime.ts";
import { marketplaceCompleted, marketplaceFailed } from "./marketplace-events.ts";
import { salvarCanal, type CanalMarketplace } from "../../lib/services/canaisMarketplace.ts";
import type { DecisionJournal } from "../../modules/adaptive-intelligence/decision-journal.ts";

/** Assinatura REUTILIZADA de salvarCanal (a real por padrão; DI para teste). */
type SalvarCanal = (
  dados: { clienteId: string; marketplace?: string; tipoAnuncio?: string; ativo?: boolean },
  journal?: DecisionJournal,
) => Promise<CanalMarketplace | null>;

export class MarketplaceAdapter implements MarketplacePort {
  constructor(
    private readonly clienteId: string,
    private readonly journal?: DecisionJournal,
    private readonly salvar: SalvarCanal = salvarCanal,
  ) {}

  async apply(op: MarketplaceOperation): Promise<CapabilityResponse> {
    try {
      // Reutiliza o serviço REAL: aqui a AIL/Journal engajam (fire-and-forget).
      const resultado = await this.salvar({ clienteId: this.clienteId, tipoAnuncio: op.valor }, this.journal);
      return resultado
        ? marketplaceCompleted({ canalId: resultado.id, marketplace: resultado.marketplace, tipoAnuncio: resultado.tipoAnuncio })
        : marketplaceFailed({ motivo: "canal indisponível (marketplace exige integração ativa)", clienteId: this.clienteId });
    } catch (erro) {
      return marketplaceFailed({ motivo: erro instanceof Error ? erro.message : String(erro), clienteId: this.clienteId });
    }
  }
}
