// MissionPort (ENG-005) — o Runtime é o adaptador por trás da porta de entrada.
// Rodar: npx tsx --test src/runtime/tests/MissionPort.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { MissionPort } from "../ports/MissionPort.ts";
import { Runtime } from "../Runtime.ts";
import { DecisionFactory } from "../decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../dispatcher/RuntimeDispatcher.ts";
import type { RuntimeEvent } from "../contracts/runtime.ts";

// Dublê "completed" no lugar da FakeCapability removida (ENG-006).
const completedCapability = { execute: () => ({ status: "completed" as const }) };

test("Runtime satisfaz MissionPort e roteia o UserIntent recebido", () => {
  const events: RuntimeEvent[] = [];
  const shell = { publish: (e: RuntimeEvent) => events.push(e) };
  // A atribuição já prova, em tempo de compilação, que Runtime implementa MissionPort.
  const port: MissionPort = new Runtime(
    new DecisionFactory(() => 0, () => "d1"),
    new RuntimeDispatcher(completedCapability, shell, () => 0),
    shell,
    () => 0,
  );
  port.receive({ missionId: "m9", type: "answer", payload: 1, timestamp: 0 });
  assert.equal(events[0].type, "DecisionCreated");
  assert.equal(events[0].missionId, "m9");
});
