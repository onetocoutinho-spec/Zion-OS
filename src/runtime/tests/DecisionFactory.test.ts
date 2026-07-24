// DecisionFactory (ENG-005) — única criadora de Decision (Lei 15).
// Rodar: npx tsx --test src/runtime/tests/DecisionFactory.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { DecisionFactory } from "../decision/DecisionFactory.ts";
import type { UserIntent } from "../contracts/runtime.ts";

const mk = (type: UserIntent["type"], payload: unknown): UserIntent => ({ missionId: "m1", type, payload, timestamp: 1 });

test("interpreta a intenção: answer/confirm → execute; cancel → dismiss", () => {
  let n = 0;
  const f = new DecisionFactory(() => 123, () => `d${++n}`);
  const a = f.create(mk("answer", "v"));
  assert.equal(a.type, "execute");
  assert.equal(a.intentType, "answer");
  assert.equal(a.missionId, "m1");
  assert.equal(a.payload, "v");
  assert.equal(a.timestamp, 123);
  assert.equal(a.id, "d1");
  assert.equal(f.create(mk("confirm", true)).type, "execute");
  assert.equal(f.create(mk("cancel", null)).type, "dismiss");
});

test("a Decision produzida é congelada e marcada (origem única)", () => {
  const d = new DecisionFactory().create(mk("answer", 1));
  assert.equal(d.kind, "decision");
  assert.ok(Object.isFrozen(d));
});

test("ids únicos por sequência (DI para determinismo)", () => {
  const f = new DecisionFactory();
  const a = f.create(mk("answer", 1));
  const b = f.create(mk("answer", 2));
  assert.notEqual(a.id, b.id);
});
