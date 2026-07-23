// Eventos da Mission (ENG-004) — fábricas puras.
// Rodar: npx tsx --test src/mission/tests/mission-events.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createUserIntent, missionOpened, missionClosed, missionCancelled, missionCompleted, userIntentEmitted,
} from "../events/mission-events.ts";

test("createUserIntent monta o evento puro (o único artefato de saída — Lei 13)", () => {
  const i = createUserIntent("m1", "answer", { x: 1 }, 123);
  assert.deepEqual(i, { missionId: "m1", type: "answer", payload: { x: 1 }, timestamp: 123 });
});

test("as cinco fábricas produzem os eventos previstos", () => {
  assert.equal(missionOpened("m1", 1).type, "MissionOpened");
  assert.equal(missionClosed("m1", 1).type, "MissionClosed");
  assert.equal(missionCancelled("m1", 1).type, "MissionCancelled");
  const i = createUserIntent("m1", "confirm", true, 5);
  assert.deepEqual(missionCompleted(i), { type: "MissionCompleted", missionId: "m1", timestamp: 5, intent: i });
  assert.deepEqual(userIntentEmitted(i), { type: "UserIntentEmitted", missionId: "m1", timestamp: 5, intent: i });
});
