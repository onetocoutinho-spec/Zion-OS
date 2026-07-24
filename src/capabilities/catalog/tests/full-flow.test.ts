// Fluxo completo Runtime → Capability (ENG-006) — usa o Runtime e a
// CatalogCapability REAIS; só a porta de catálogo (infra) é dublê.
// Rodar: npx tsx --test src/capabilities/catalog/tests/full-flow.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../../../runtime/Runtime.ts";
import { DecisionFactory } from "../../../runtime/decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../../../runtime/dispatcher/RuntimeDispatcher.ts";
import { CatalogCapability, type CatalogOperation, type CatalogPort } from "../CatalogCapability.ts";
import type { RuntimeEvent, UserIntent } from "../../../runtime/contracts/runtime.ts";

test("UserIntent → Runtime → Decision → CatalogCapability → eventos publicados", async () => {
  const events: RuntimeEvent[] = [];
  const shell = { publish: (e: RuntimeEvent) => events.push(e) };
  const applied: CatalogOperation[] = [];
  const catalog: CatalogPort = { apply: async (op) => { applied.push(op); return { status: "completed", detail: op }; } };

  const runtime = new Runtime(
    new DecisionFactory(() => 0, () => "d1"),
    new RuntimeDispatcher(new CatalogCapability(catalog), shell, () => 0),
    shell,
    () => 0,
  );

  const intent: UserIntent = { missionId: "categoria-marketplace", type: "answer", payload: "Calçados > Chinelos", timestamp: 0 };
  runtime.receive(intent);
  await new Promise((r) => setTimeout(r, 0));

  assert.deepEqual(events.map((e) => e.type), ["DecisionCreated", "CapabilityRequested", "CapabilityCompleted"]);
  assert.deepEqual(applied, [{ campo: "categoriaMarketplace", valor: "Calçados > Chinelos" }]);
  assert.equal(events[2].response?.status, "completed");
});
