// FakeCapability (ENG-005) — a única Capability desta etapa; sempre completed.
// Rodar: npx tsx --test src/runtime/tests/FakeCapability.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeCapability } from "../FakeCapability.ts";

test("FakeCapability retorna exatamente { status: 'completed' }", () => {
  const res = new FakeCapability().execute({ decisionId: "d", missionId: "m", payload: null });
  assert.deepEqual(res, { status: "completed" });
});
