// MarketplaceAdapter (CAP-002) — integração com salvarCanal (stubado).
// Rodar: npx tsx --test src/capabilities/marketplace/tests/MarketplaceAdapter.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { MarketplaceAdapter } from "../MarketplaceAdapter.ts";
import { InMemoryDecisionJournal } from "../../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";
import type { DecisionJournal } from "../../../modules/adaptive-intelligence/decision-journal.ts";
import type { CanalMarketplace } from "../../../lib/services/canaisMarketplace.ts";

type Dados = { clienteId: string; marketplace?: string; tipoAnuncio?: string; ativo?: boolean };

function stubSalvar(retorno: (d: Dados) => CanalMarketplace | null) {
  const calls: { dados: Dados; journal?: DecisionJournal }[] = [];
  const fn = async (dados: Dados, journal?: DecisionJournal): Promise<CanalMarketplace | null> => {
    calls.push({ dados, journal });
    return retorno(dados);
  };
  return { fn, calls };
}

test("apply chama salvarCanal com clienteId + tipoAnuncio + journal → completed", async () => {
  const s = stubSalvar((d) => ({ id: "canal-1", clienteId: d.clienteId, marketplace: "Mercado Livre", sellerId: null, tipoAnuncio: d.tipoAnuncio ?? "", ativo: true }));
  const journal = new InMemoryDecisionJournal();
  const adapter = new MarketplaceAdapter("cli-01", journal, s.fn);
  const res = await adapter.apply({ campo: "tipoAnuncio", valor: "Classic" });
  assert.equal(res.status, "completed");
  assert.deepEqual(s.calls[0].dados, { clienteId: "cli-01", tipoAnuncio: "Classic" });
  assert.equal(s.calls[0].journal, journal); // repassa o Port da AIL existente (reuso)
});

test("canal indisponível (null) → failed", async () => {
  const adapter = new MarketplaceAdapter("cli-01", undefined, async () => null);
  assert.equal((await adapter.apply({ campo: "tipoAnuncio", valor: "Premium" })).status, "failed");
});

test("exceção da infraestrutura → failed (fronteira não vaza)", async () => {
  const adapter = new MarketplaceAdapter("cli-01", undefined, async () => { throw new Error("supabase down"); });
  assert.equal((await adapter.apply({ campo: "tipoAnuncio", valor: "Premium" })).status, "failed");
});
