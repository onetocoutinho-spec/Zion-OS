// Teste do núcleo puro do ShellProvider (ENG-003) — estado visual só.
// Rodar: npx tsx --test src/shell/providers/ShellProvider.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { initialShellState, shellReducer } from "./ShellProvider.tsx";

test("initialShellState: contexto = initialContext ou 1º da navegação; missão/feedback neutros", () => {
  assert.equal(initialShellState({ navigation: [{ id: "a", label: "A" }] }).activeId, "a");
  assert.equal(initialShellState({ navigation: [{ id: "a", label: "A" }], initialContext: "b" }).activeId, "b");
  assert.deepEqual(initialShellState({ navigation: [] }).mission, { active: false });
  assert.equal(initialShellState({ navigation: [] }).feedback.kind, "idle");
});

test("shellReducer: só setContext/setMission/setFeedback mudam o estado (visual, nunca negócio)", () => {
  let s = initialShellState({ navigation: [{ id: "a", label: "A" }, { id: "b", label: "B" }] });
  s = shellReducer(s, { type: "setContext", id: "b" });
  assert.equal(s.activeId, "b");
  s = shellReducer(s, { type: "setMission", mission: { active: true, title: "M" } });
  assert.equal(s.mission.active, true);
  s = shellReducer(s, { type: "setFeedback", feedback: { kind: "running" } });
  assert.equal(s.feedback.kind, "running");
  // imutabilidade: transição não muta o estado anterior
  const before = initialShellState({ navigation: [{ id: "a", label: "A" }] });
  shellReducer(before, { type: "setContext", id: "z" });
  assert.equal(before.activeId, "a");
});
