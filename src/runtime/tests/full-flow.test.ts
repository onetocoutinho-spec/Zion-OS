// Fluxo completo (ENG-005) — UserIntent → Runtime → Decision → Dispatcher →
// FakeCapability → RuntimeEvents. Prova o modelo constitucional inteiro.
// Rodar: npx tsx --test src/runtime/tests/full-flow.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../Runtime.ts";
import { DecisionFactory } from "../decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../dispatcher/RuntimeDispatcher.ts";
import type { RuntimeEvent, UserIntent } from "../contracts/runtime.ts";

// Dublê "completed" no lugar da FakeCapability removida (ENG-006).
const completedCapability = { execute: () => ({ status: "completed" as const }) };

test("UserIntent → Runtime → Decision → CapabilityPort → eventos publicados", async () => {
  const events: RuntimeEvent[] = [];
  const shell = { publish: (e: RuntimeEvent) => events.push(e) };
  const runtime = new Runtime(
    new DecisionFactory(() => 111, () => "decision-1"),
    new RuntimeDispatcher(completedCapability, shell, () => 222),
    shell,
    () => 222,
  );

  const intent: UserIntent = { missionId: "codigo-de-barras", type: "answer", payload: "7899876543210", timestamp: 999 };
  runtime.receive(intent);
  await new Promise((r) => setTimeout(r, 0));

  assert.deepEqual(events.map((e) => e.type), ["DecisionCreated", "CapabilityRequested", "CapabilityCompleted"]);

  const decision = events[0].decision!;
  assert.deepEqual(
    { id: decision.id, type: decision.type, missionId: decision.missionId, intentType: decision.intentType, payload: decision.payload },
    { id: "decision-1", type: "execute", missionId: "codigo-de-barras", intentType: "answer", payload: "7899876543210" },
  );
  assert.equal(events[1].request?.decisionId, "decision-1");
  assert.equal(events[2].response?.status, "completed");
});
