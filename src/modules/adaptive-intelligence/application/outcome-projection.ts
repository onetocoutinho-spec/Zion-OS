// Outcome Projection (E5.1) — a primeira projeção de Outcomes da Zion.
//
// Fluxo único, sem regra de negócio nova (toda a semântica vive no domínio):
//
//   Offer Ledger (`ofertas`) ─┐
//                             ├─→ Offer Observation (E5.0) ─→ outcomeDe() ─→ Outcome[]
//   Decision Journal ─────────┘
//
// A projeção é COMPLETAMENTE RECONSTRUÍVEL: nenhum estado, nenhum cursor,
// nenhuma persistência — o mesmo contrato do Detector (RFC-AIL-004 §7.3) e a
// materialização literal da ADR-001: "ledger de Outcomes" = projeção
// f(ofertas × Journal), computada na leitura, jamais armazenada.
//
// Fontes autorizadas: SOMENTE Offer Ledger + Decision Journal (via E5.0).
// Nenhuma outra projeção é consultada. Nenhuma observação é recalculada:
// projetar = mapear o resultado da E5.0.

import type { Oferta } from "../domain/offer.ts";
import { outcomeDe, type Outcome } from "../domain/outcome.ts";
import type { Decision } from "../domain/decision.ts";
import {
  observarOferta,
  observarOfertas,
  type ReposObservacao,
} from "./offer-observation.ts";

/**
 * PURA: o Outcome de UMA oferta, dado o Journal. Determinística e idempotente:
 * mesmos fatos → mesmo Outcome (sem relógio, sem NOW, sem recência).
 */
export function projetarOutcome(oferta: Oferta, decisoes: readonly Decision[]): Outcome {
  return outcomeDe(observarOferta(oferta, decisoes));
}

/**
 * Projeta os Outcomes de todas as ofertas (opcionalmente por empresa).
 * Leitura pura sobre os dois logs; ordem = a da observação (recentes primeiro).
 */
export async function projetarOutcomes(
  empresa?: string,
  repos?: ReposObservacao
): Promise<Outcome[]> {
  const observacoes = await observarOfertas(empresa, repos);
  return observacoes.map(outcomeDe);
}
