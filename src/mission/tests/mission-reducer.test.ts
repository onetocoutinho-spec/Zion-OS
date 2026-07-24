// Reducer da Mission (ENG-004) — Functional Core puro.
// Rodar: npx tsx --test src/mission/tests/mission-reducer.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { initialMissionState, missionReducer, toMission } from "../provider/mission-reducer.ts";
import type { MissionPayload } from "../contracts/mission.ts";

const payload: MissionPayload = { id: "m1", type: "input", title: "T", body: { kind: "input", inputType: "text" } };

test("máquina visual: hidden → appearing → active → waiting → closing → hidden", () => {
  let s = initialMissionState;
  assert.equal(s.state, "hidden");
  s = missionReducer(s, { type: "OPEN", payload });
  assert.equal(s.state, "appearing");
  assert.equal(s.payload?.id, "m1");
  s = missionReducer(s, { type: "ACTIVATE" });
  assert.equal(s.state, "active");
  s = missionReducer(s, { type: "WAIT" });
  assert.equal(s.state, "waiting");
  s = missionReducer(s, { type: "CLOSE" });
  assert.equal(s.state, "closing");
  s = missionReducer(s, { type: "CLEAR" });
  assert.equal(s.state, "hidden");
  assert.equal(s.payload, null);
});

test("guardas: transições sem payload não avançam", () => {
  assert.equal(missionReducer(initialMissionState, { type: "ACTIVATE" }).state, "hidden");
  assert.equal(missionReducer(initialMissionState, { type: "CLOSE" }).state, "hidden");
});

test("toMission deriva o contrato ou null; sem mutar", () => {
  assert.equal(toMission(initialMissionState), null);
  const s = missionReducer(initialMissionState, { type: "OPEN", payload });
  assert.deepEqual(toMission(s), { payload, state: "appearing" });
  assert.equal(initialMissionState.state, "hidden"); // imutável
});
