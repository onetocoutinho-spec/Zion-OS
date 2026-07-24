// Fluxo completo Runtime → MarketplaceCapability (CAP-002) — a demonstração do
// diagrama constitucional até Success. Runtime e Capability REAIS; só a porta de
// marketplace (infra) é dublê (mockar apenas infraestrutura externa).
// Rodar: npx tsx --test src/capabilities/marketplace/tests/full-flow.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../../../runtime/Runtime.ts";
import { DecisionFactory } from "../../../runtime/decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../../../runtime/dispatcher/RuntimeDispatcher.ts";
import { MarketplaceCapability } from "../MarketplaceCapability.ts";
import type { MarketplaceOperation, MarketplacePort } from "../marketplace-contracts.ts";
import type { RuntimeEvent, UserIntent } from "../../../runtime/contracts/runtime.ts";

test("UserIntent → Runtime → Decision → MarketplaceCapability → eventos (Success)", async () => {
  const events: RuntimeEvent[] = [];
  const shell = { publish: (e: RuntimeEvent) => events.push(e) };
  const applied: MarketplaceOperation[] = [];
  const marketplace: MarketplacePort = { apply: async (op) => { applied.push(op); return { status: "completed", detail: op }; } };

  const runtime = new Runtime(
    new DecisionFactory(() => 0, () => "d1"),
    new RuntimeDispatcher(new MarketplaceCapability(marketplace), shell, () => 0),
    shell,
    () => 0,
  );

  const intent: UserIntent = { missionId: "tipo-anuncio", type: "answer", payload: "Classic", timestamp: 0 };
  runtime.receive(intent);
  await new Promise((r) => setTimeout(r, 0));

  assert.deepEqual(events.map((e) => e.type), ["DecisionCreated", "CapabilityRequested", "CapabilityCompleted"]);
  assert.deepEqual(applied, [{ campo: "tipoAnuncio", valor: "Classic" }]);
  assert.equal(events[2].response?.status, "completed");
});
