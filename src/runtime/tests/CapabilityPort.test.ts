// CapabilityPort (ENG-005) — contrato de execução (interface, não impl).
// Rodar: npx tsx --test src/runtime/tests/CapabilityPort.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { CapabilityPort } from "../ports/CapabilityPort.ts";
import { FakeCapability } from "../FakeCapability.ts";

test("FakeCapability satisfaz CapabilityPort e responde completed", async () => {
  const port: CapabilityPort = new FakeCapability();
  const res = await port.execute({ decisionId: "d1", missionId: "m1", payload: "x" });
  assert.deepEqual(res, { status: "completed" });
});

test("a porta aceita qualquer adaptador do contrato (ex.: um que falha)", async () => {
  const failing: CapabilityPort = { execute: () => ({ status: "failed", detail: "nope" }) };
  const res = await failing.execute({ decisionId: "d", missionId: "m", payload: null });
  assert.equal(res.status, "failed");
});
