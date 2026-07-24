// PendenciasCapability (PR-1) — tradução Decision → operação de pendência.
// Rodar: npx tsx --test src/capabilities/pendencias/tests/PendenciasCapability.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { PendenciasCapability } from "../PendenciasCapability.ts";
import type { PendenciaOperation, PendenciasPort } from "../pendencias-contracts.ts";
import type { CapabilityRequest } from "../../../runtime/contracts/runtime.ts";

function fakePendencias() {
  const ops: PendenciaOperation[] = [];
  const port: PendenciasPort = { resolver: async (op) => { ops.push(op); return { status: "completed", detail: op }; } };
  return { port, ops };
}
const req = (missionId: string, payload: unknown): CapabilityRequest => ({ decisionId: "d1", missionId, payload });

test("traduz a Decision (resolver-pendencia) numa operação e delega", async () => {
  const p = fakePendencias();
  const res = await new PendenciasCapability(p.port).execute(req("resolver-pendencia", "pen-01"));
  assert.equal(res.status, "completed");
  assert.deepEqual(p.ops, [{ acao: "resolver", pendenciaId: "pen-01" }]);
});

test("missão não mapeada → failed, sem tocar o serviço (nunca inventa operação)", async () => {
  const p = fakePendencias();
  const res = await new PendenciasCapability(p.port).execute(req("missao-desconhecida", "pen-01"));
  assert.equal(res.status, "failed");
  assert.equal(p.ops.length, 0);
});

test("pendenciaId vazio → failed, sem tocar o serviço", async () => {
  const p = fakePendencias();
  const res = await new PendenciasCapability(p.port).execute(req("resolver-pendencia", "   "));
  assert.equal(res.status, "failed");
  assert.equal(p.ops.length, 0);
});
