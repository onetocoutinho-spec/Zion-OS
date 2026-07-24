// CatalogCapabilityAdapter (ENG-006) — integração com atualizarProduto (stubado).
// Rodar: npx tsx --test src/capabilities/catalog/tests/CatalogCapabilityAdapter.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { CatalogCapabilityAdapter } from "../CatalogCapabilityAdapter.ts";
import { InMemoryDecisionJournal } from "../../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";
import type { DecisionJournal } from "../../../modules/adaptive-intelligence/decision-journal.ts";
import type { Produto } from "../../../lib/types.ts";

function stubAtualizar(retorno: (id: string, dados: Partial<Produto>) => Produto | null) {
  const calls: { id: string; dados: Partial<Produto>; journal?: DecisionJournal }[] = [];
  const fn = async (id: string, dados: Partial<Produto>, journal?: DecisionJournal): Promise<Produto | null> => {
    calls.push({ id, dados, journal });
    return retorno(id, dados);
  };
  return { fn, calls };
}

test("apply chama atualizarProduto com produtoId + campo REAL observado + journal → completed", async () => {
  const s = stubAtualizar((id, dados) => ({ id, ...dados }) as Produto);
  const journal = new InMemoryDecisionJournal();
  const adapter = new CatalogCapabilityAdapter("prd-99", journal, s.fn);
  const res = await adapter.apply({ campo: "categoriaMarketplace", valor: "Calçados" });
  assert.equal(res.status, "completed");
  assert.equal(s.calls[0].id, "prd-99");
  assert.deepEqual(s.calls[0].dados, { categoriaMarketplaceSugerida: "Calçados" }); // propriedade real do Produto
  assert.equal(s.calls[0].journal, journal); // repassa o Port da AIL existente (reuso)
});

test("produto não encontrado (null) → failed", async () => {
  const adapter = new CatalogCapabilityAdapter("x", undefined, async () => null);
  assert.equal((await adapter.apply({ campo: "categoriaMarketplace", valor: "Y" })).status, "failed");
});

test("exceção da infraestrutura → failed (fronteira não vaza)", async () => {
  const adapter = new CatalogCapabilityAdapter("x", undefined, async () => { throw new Error("supabase down"); });
  const res = await adapter.apply({ campo: "categoriaMarketplace", valor: "Y" });
  assert.equal(res.status, "failed");
});
