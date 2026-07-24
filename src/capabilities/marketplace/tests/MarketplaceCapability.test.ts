// MarketplaceCapability (CAP-002) — tradução Decision → operação de marketplace.
// Rodar: npx tsx --test src/capabilities/marketplace/tests/MarketplaceCapability.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { MarketplaceCapability } from "../MarketplaceCapability.ts";
import type { MarketplaceOperation, MarketplacePort } from "../marketplace-contracts.ts";
import type { CapabilityRequest } from "../../../runtime/contracts/runtime.ts";

function fakeMarketplace() {
  const ops: MarketplaceOperation[] = [];
  const port: MarketplacePort = { apply: async (op) => { ops.push(op); return { status: "completed", detail: op }; } };
  return { port, ops };
}
const req = (missionId: string, payload: unknown): CapabilityRequest => ({ decisionId: "d1", missionId, payload });

test("traduz a Decision (tipo-anuncio) numa operação de marketplace e delega", async () => {
  const m = fakeMarketplace();
  const res = await new MarketplaceCapability(m.port).execute(req("tipo-anuncio", "Classic"));
  assert.equal(res.status, "completed");
  assert.deepEqual(m.ops, [{ campo: "tipoAnuncio", valor: "Classic" }]);
});

test("missão não mapeada → failed, sem tocar o marketplace (nunca inventa operação)", async () => {
  const m = fakeMarketplace();
  const res = await new MarketplaceCapability(m.port).execute(req("missao-desconhecida", "Premium"));
  assert.equal(res.status, "failed");
  assert.equal(m.ops.length, 0);
});

test("valor vazio → failed, sem tocar o marketplace", async () => {
  const m = fakeMarketplace();
  const res = await new MarketplaceCapability(m.port).execute(req("tipo-anuncio", "   "));
  assert.equal(res.status, "failed");
  assert.equal(m.ops.length, 0);
});
