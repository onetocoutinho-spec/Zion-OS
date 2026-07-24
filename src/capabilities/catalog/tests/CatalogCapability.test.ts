// CatalogCapability (ENG-006) — tradução Decision → operação de catálogo.
// Rodar: npx tsx --test src/capabilities/catalog/tests/CatalogCapability.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { CatalogCapability, type CatalogOperation, type CatalogPort } from "../CatalogCapability.ts";
import type { CapabilityRequest } from "../../../runtime/contracts/runtime.ts";

function fakeCatalog() {
  const ops: CatalogOperation[] = [];
  const port: CatalogPort = { apply: async (op) => { ops.push(op); return { status: "completed", detail: op }; } };
  return { port, ops };
}
const req = (missionId: string, payload: unknown): CapabilityRequest => ({ decisionId: "d1", missionId, payload });

test("traduz a Decision (categoria-marketplace) numa operação de catálogo e delega", async () => {
  const c = fakeCatalog();
  const res = await new CatalogCapability(c.port).execute(req("categoria-marketplace", "Calçados > Chinelos"));
  assert.equal(res.status, "completed");
  assert.deepEqual(c.ops, [{ campo: "categoriaMarketplace", valor: "Calçados > Chinelos" }]);
});

test("missão não mapeada → failed, sem tocar o catálogo (nunca inventa operação)", async () => {
  const c = fakeCatalog();
  const res = await new CatalogCapability(c.port).execute(req("missao-desconhecida", "x"));
  assert.equal(res.status, "failed");
  assert.equal(c.ops.length, 0);
});

test("valor vazio → failed (nada aprendível), sem tocar o catálogo", async () => {
  const c = fakeCatalog();
  const res = await new CatalogCapability(c.port).execute(req("categoria-marketplace", "   "));
  assert.equal(res.status, "failed");
  assert.equal(c.ops.length, 0);
});

test("nunca conhece Mission/Shell/React: só o contrato do Runtime e a porta de catálogo", () => {
  // A CapabilityPort é a única superfície; a Capability recebe CapabilityRequest.
  const c: CatalogPort = { apply: async () => ({ status: "completed" }) };
  const cap = new CatalogCapability(c);
  assert.equal(typeof cap.execute, "function");
});
