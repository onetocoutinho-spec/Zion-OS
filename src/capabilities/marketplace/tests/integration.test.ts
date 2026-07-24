// Integração REAL (CAP-002) — prova o reuso do serviço existente e da captura
// AIL, sem duplicar. salvarCanal é Supabase-only; em node ele devolve null (o
// Adapter reflete isso). A captura de decisão de marketplace é provada pelo
// builder REAL (montarCapturaTipoAnuncio) + capturarDecisao REAL → Journal.
// Rodar: npx tsx --test src/capabilities/marketplace/tests/integration.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { MarketplaceAdapter } from "../MarketplaceAdapter.ts";
import { montarCapturaTipoAnuncio } from "../../../lib/services/canaisMarketplace.ts";
import { capturarDecisao } from "../../../modules/adaptive-intelligence/decision-journal.ts";
import { InMemoryDecisionJournal } from "../../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

test("reuso REAL de salvarCanal: sem Supabase (node) devolve null → Adapter failed", async () => {
  // Sem injetar 'salvar' → usa o salvarCanal REAL (canaisMarketplace.ts).
  const adapter = new MarketplaceAdapter("cli-01");
  const res = await adapter.apply({ campo: "tipoAnuncio", valor: "Classic" });
  assert.equal(res.status, "failed"); // salvarCanal: `if (!supabaseConfigurado) return null`
});

test("captura AIL de marketplace: montarCapturaTipoAnuncio REAL → capturarDecisao → Journal", () => {
  const journal = new InMemoryDecisionJournal();
  // Exatamente a mesma captura que salvarCanal faz internamente (reuso do builder REAL).
  const captura = montarCapturaTipoAnuncio({ clienteId: "cli-01", tipoAnuncio: "Classic" }, null);
  assert.ok(captura);
  capturarDecisao({ ...captura, autor: "equipe@zion.com" }, journal);

  assert.equal(journal.recebidas.length, 1);
  const d = journal.recebidas[0];
  assert.equal(d.campo, "tipoAnuncio");
  assert.equal(d.contexto, "publicacao");
  assert.equal(d.valorNovo, "Classic");
  assert.equal(d.origem, "canaisMarketplace.salvarCanal"); // origem existente, não inventada
});
