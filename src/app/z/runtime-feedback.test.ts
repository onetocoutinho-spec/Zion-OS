// Feedback mapping + fluxo completo até o feedback (ENG-007).
// Rodar: npx tsx --test src/app/z/runtime-feedback.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapRuntimeEventToFeedback } from "./runtime-feedback.ts";
import type { RuntimeEvent } from "../../runtime/contracts/runtime.ts";
import type { FeedbackState } from "../../shell/contracts/shell.ts";

import { Runtime } from "../../runtime/Runtime.ts";
import { DecisionFactory } from "../../runtime/decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../../runtime/dispatcher/RuntimeDispatcher.ts";
import { CatalogCapability, type CatalogPort } from "../../capabilities/catalog/CatalogCapability.ts";
import type { UserIntent } from "../../runtime/contracts/runtime.ts";

const ev = (type: RuntimeEvent["type"], response?: RuntimeEvent["response"]): RuntimeEvent => ({ type, timestamp: 0, response });

test("mapeamento: cada RuntimeEvent → o estado visual previsto (nenhuma outra interpretação)", () => {
  assert.deepEqual(mapRuntimeEventToFeedback(ev("DecisionCreated")), { kind: "loading" });
  assert.deepEqual(mapRuntimeEventToFeedback(ev("CapabilityRequested")), { kind: "running" });
  assert.deepEqual(mapRuntimeEventToFeedback(ev("CapabilityCompleted")), { kind: "completed" });
  assert.deepEqual(mapRuntimeEventToFeedback(ev("CapabilityFailed", { status: "failed", detail: { motivo: "sem sessão" } })), { kind: "error", message: "sem sessão" });
});

// Constrói o Runtime REAL + CatalogCapability REAL; só a porta de catálogo é dublê.
// A ShellPort traduz cada RuntimeEvent em feedback — como no composition root /z.
function runComFeedback(catalog: CatalogPort) {
  const feedbacks: FeedbackState[] = [];
  const shellPort = { publish: (e: RuntimeEvent) => feedbacks.push(mapRuntimeEventToFeedback(e)) };
  const runtime = new Runtime(
    new DecisionFactory(() => 0, () => "d1"),
    new RuntimeDispatcher(new CatalogCapability(catalog), shellPort, () => 0),
    shellPort,
    () => 0,
  );
  const intent: UserIntent = { missionId: "categoria-marketplace", type: "answer", payload: "Calçados > Chinelos", timestamp: 0 };
  runtime.receive(intent);
  return feedbacks;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test("fluxo completo (sucesso): feedback percorre loading → running → completed", async () => {
  const feedbacks = runComFeedback({ apply: async () => ({ status: "completed" }) });
  await flush();
  assert.deepEqual(feedbacks.map((f) => f.kind), ["loading", "running", "completed"]);
});

test("fluxo completo (falha): feedback termina em error", async () => {
  const feedbacks = runComFeedback({ apply: async () => ({ status: "failed", detail: { motivo: "produto não encontrado" } }) });
  await flush();
  assert.deepEqual(feedbacks.map((f) => f.kind), ["loading", "running", "error"]);
  assert.equal(feedbacks.at(-1)?.message, "produto não encontrado");
});
