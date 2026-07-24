// Fluxo completo Runtime → PendenciasCapability (PR-1) — a validação
// Runtime → Capability → Adapter do PLAYBOOK. Runtime e Capability REAIS; só a
// porta de pendências (infra) é dublê (mockar apenas infraestrutura externa).
// Rodar: npx tsx --test src/capabilities/pendencias/tests/full-flow.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { Runtime } from "../../../runtime/Runtime.ts";
import { DecisionFactory } from "../../../runtime/decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../../../runtime/dispatcher/RuntimeDispatcher.ts";
import { PendenciasCapability } from "../PendenciasCapability.ts";
import type { PendenciaOperation, PendenciasPort } from "../pendencias-contracts.ts";
import type { RuntimeEvent, UserIntent } from "../../../runtime/contracts/runtime.ts";

test("UserIntent → Runtime → Decision → PendenciasCapability → eventos (completed)", async () => {
  const events: RuntimeEvent[] = [];
  const shell = { publish: (e: RuntimeEvent) => events.push(e) };
  const resolvidas: PendenciaOperation[] = [];
  const pendencias: PendenciasPort = { resolver: async (op) => { resolvidas.push(op); return { status: "completed", detail: op }; } };

  const runtime = new Runtime(
    new DecisionFactory(() => 0, () => "d1"),
    new RuntimeDispatcher(new PendenciasCapability(pendencias), shell, () => 0),
    shell,
    () => 0,
  );

  const intent: UserIntent = { missionId: "resolver-pendencia", type: "answer", payload: "pen-01", timestamp: 0 };
  runtime.receive(intent);
  await new Promise((r) => setTimeout(r, 0));

  assert.deepEqual(events.map((e) => e.type), ["DecisionCreated", "CapabilityRequested", "CapabilityCompleted"]);
  assert.deepEqual(resolvidas, [{ acao: "resolver", pendenciaId: "pen-01" }]);
  assert.equal(events[2].response?.status, "completed");
});

test("cancel → Decision dismiss, sem despacho de pendência", async () => {
  const events: RuntimeEvent[] = [];
  const shell = { publish: (e: RuntimeEvent) => events.push(e) };
  const resolvidas: PendenciaOperation[] = [];
  const pendencias: PendenciasPort = { resolver: async (op) => { resolvidas.push(op); return { status: "completed" }; } };

  const runtime = new Runtime(
    new DecisionFactory(() => 0, () => "d1"),
    new RuntimeDispatcher(new PendenciasCapability(pendencias), shell, () => 0),
    shell,
    () => 0,
  );
  runtime.receive({ missionId: "resolver-pendencia", type: "cancel", payload: null, timestamp: 0 });
  await new Promise((r) => setTimeout(r, 0));

  assert.deepEqual(events.map((e) => e.type), ["DecisionCreated"]);
  assert.equal(resolvidas.length, 0);
});
