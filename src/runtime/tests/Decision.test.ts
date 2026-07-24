// Decision (ENG-005) — imutabilidade + guarda de autenticidade.
// Rodar: npx tsx --test src/runtime/tests/Decision.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { DecisionFactory } from "../decision/DecisionFactory.ts";
import { isDecision } from "../decision/Decision.ts";
import type { UserIntent } from "../contracts/runtime.ts";

const intent: UserIntent = { missionId: "m1", type: "answer", payload: "x", timestamp: 1 };

test("isDecision: verdadeiro só para Decision marcada E congelada", () => {
  const d = new DecisionFactory(() => 0, () => "d1").create(intent);
  assert.ok(isDecision(d));
  assert.equal(isDecision({ kind: "decision", id: "x" }), false); // não congelada
  assert.equal(isDecision(Object.freeze({ id: "x" })), false); // sem marca
  assert.equal(isDecision(null), false);
});

test("Decision é imutável: tentativa de escrita não altera o valor", () => {
  const d = new DecisionFactory(() => 0, () => "d1").create(intent);
  try { (d as { id: string }).id = "hack"; } catch { /* strict mode lança; ignorar */ }
  assert.equal(d.id, "d1");
  assert.ok(Object.isFrozen(d));
});
