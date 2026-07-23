// Runtime (ENG-005) — orquestra receive → Decision → dispatch.
// Rodar: npx tsx --test src/runtime/tests/Runtime.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../Runtime.ts";
import { DecisionFactory } from "../decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../dispatcher/RuntimeDispatcher.ts";
import { FakeCapability } from "../FakeCapability.ts";
import type { RuntimeEvent, UserIntent } from "../contracts/runtime.ts";

const build = () => {
  const events: RuntimeEvent[] = [];
  const shell = { publish: (e: RuntimeEvent) => events.push(e) };
  const runtime = new Runtime(
    new DecisionFactory(() => 0, () => "d1"),
    new RuntimeDispatcher(new FakeCapability(), shell, () => 0),
    shell,
    () => 0,
  );
  return { runtime, events };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

test("receive(answer): DecisionCreated (execute) → CapabilityRequested → CapabilityCompleted", async () => {
  const { runtime, events } = build();
  const intent: UserIntent = { missionId: "m1", type: "answer", payload: "789", timestamp: 0 };
  runtime.receive(intent);
  await flush();
  assert.deepEqual(events.map((e) => e.type), ["DecisionCreated", "CapabilityRequested", "CapabilityCompleted"]);
  assert.equal(events[0].decision?.type, "execute");
});

test("receive(cancel): DecisionCreated (dismiss) e NENHUM despacho de Capability", async () => {
  const { runtime, events } = build();
  runtime.receive({ missionId: "m1", type: "cancel", payload: null, timestamp: 0 });
  await flush();
  assert.deepEqual(events.map((e) => e.type), ["DecisionCreated"]);
  assert.equal(events[0].decision?.type, "dismiss");
});
