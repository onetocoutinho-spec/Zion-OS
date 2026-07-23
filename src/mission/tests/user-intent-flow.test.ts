// Fluxo de UserIntent (ENG-004) — prova constitucional: o fluxo termina no
// UserIntent; NENHUMA Decision é produzida (Lei 13). Puro, sem Runtime.
// Rodar: npx tsx --test src/mission/tests/user-intent-flow.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { initialMissionState, missionReducer } from "../provider/mission-reducer.ts";
import { createUserIntent, missionOpened, missionClosed, missionCompleted, userIntentEmitted } from "../events/mission-events.ts";
import type { MissionEvent } from "../events/mission-events.ts";
import type { MissionPayload } from "../contracts/mission.ts";

const payload: MissionPayload = {
  id: "m1", type: "input", title: "Qual é o código de barras?",
  description: "Precisamos desta informação para concluir o cadastro.",
  body: { kind: "input", inputType: "text" },
};

test("Capability→Shell→Mission→Usuário→UserIntent→MissionClosed; o fluxo termina no UserIntent", () => {
  const events: MissionEvent[] = [];

  // Shell → MissionLayer → Mission (aberta)
  let s = missionReducer(initialMissionState, { type: "OPEN", payload });
  events.push(missionOpened(payload.id, 100));
  s = missionReducer(s, { type: "ACTIVATE" });
  s = missionReducer(s, { type: "WAIT" });

  // Usuário responde → produz EXCLUSIVAMENTE um UserIntent
  const intent = createUserIntent(payload.id, "answer", "7891234567890", 200);
  events.push(userIntentEmitted(intent), missionCompleted(intent));

  // Mission fecha
  s = missionReducer(s, { type: "CLOSE" });
  events.push(missionClosed(payload.id, 200));
  s = missionReducer(s, { type: "CLEAR" });

  assert.equal(s.state, "hidden");
  assert.deepEqual(intent, { missionId: "m1", type: "answer", payload: "7891234567890", timestamp: 200 });
  assert.deepEqual(events.map((e) => e.type), ["MissionOpened", "UserIntentEmitted", "MissionCompleted", "MissionClosed"]);

  // Nenhuma Decision existe nesta etapa — só UserIntent.
  assert.ok(!("decision" in intent));
  assert.equal((intent as { type: string }).type, "answer");
});
