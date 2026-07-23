// RuntimeDispatcher (ENG-005) — despacha Decision pela CapabilityPort.
// Rodar: npx tsx --test src/runtime/tests/RuntimeDispatcher.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { RuntimeDispatcher } from "../dispatcher/RuntimeDispatcher.ts";
import { FakeCapability } from "../FakeCapability.ts";
import { DecisionFactory } from "../decision/DecisionFactory.ts";
import type { CapabilityPort } from "../ports/CapabilityPort.ts";
import type { RuntimeEvent } from "../contracts/runtime.ts";

const decision = new DecisionFactory(() => 0, () => "d1").create({ missionId: "m1", type: "answer", payload: "p", timestamp: 0 });
const capture = () => {
  const events: RuntimeEvent[] = [];
  return { shell: { publish: (e: RuntimeEvent) => events.push(e) }, events };
};

test("dispatch: CapabilityRequested → CapabilityCompleted (fake completed)", async () => {
  const c = capture();
  await new RuntimeDispatcher(new FakeCapability(), c.shell, () => 7).dispatch(decision);
  assert.deepEqual(c.events.map((e) => e.type), ["CapabilityRequested", "CapabilityCompleted"]);
  assert.equal(c.events[0].request?.decisionId, "d1");
  assert.equal(c.events[0].request?.missionId, "m1");
  assert.equal(c.events[1].response?.status, "completed");
});

test("dispatch: resposta failed → CapabilityFailed", async () => {
  const c = capture();
  const failing: CapabilityPort = { execute: () => ({ status: "failed", detail: "nope" }) };
  await new RuntimeDispatcher(failing, c.shell, () => 0).dispatch(decision);
  assert.deepEqual(c.events.map((e) => e.type), ["CapabilityRequested", "CapabilityFailed"]);
});

test("dispatch: exceção da Capability → CapabilityFailed", async () => {
  const c = capture();
  const throwing: CapabilityPort = { execute: () => { throw new Error("boom"); } };
  await new RuntimeDispatcher(throwing, c.shell, () => 0).dispatch(decision);
  assert.equal(c.events.at(-1)?.type, "CapabilityFailed");
});
