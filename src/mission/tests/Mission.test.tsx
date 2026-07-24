// Mission (ENG-004) — apresentação por contrato, via injeção de contexto (DI).
// Rodar: npx tsx --test src/mission/tests/Mission.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MissionReactContext, type MissionContextValue } from "../provider/MissionProvider.tsx";
import { Mission } from "../components/Mission.tsx";
import type { Mission as MissionContract, MissionPayload } from "../contracts/mission.ts";

function ctx(mission: MissionContract | null): MissionContextValue {
  return {
    mission,
    open() {},
    close() {},
    emitIntent() { return { missionId: "x", type: "answer", payload: null, timestamp: 0 }; },
    clear() {},
  };
}
const render = (m: MissionContract | null) =>
  renderToStaticMarkup(<MissionReactContext.Provider value={ctx(m)}><Mission /></MissionReactContext.Provider>);

test("Mission oculta (sem missão) não renderiza nada", () => {
  assert.equal(render(null), "");
});

test("Mission input: role=dialog, ARIA, título, descrição, corpo e rodapé", () => {
  const payload: MissionPayload = {
    id: "m1", type: "input", title: "Qual é o código de barras?",
    description: "Precisamos desta informação para concluir o cadastro.",
    body: { kind: "input", inputType: "text", placeholder: "Ex.: 789…" },
    confirmLabel: "Confirmar", cancelLabel: "Cancelar",
  };
  const html = render({ payload, state: "waiting" });
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-labelledby="mission-title-m1"/);
  assert.match(html, /aria-describedby="mission-desc-m1"/);
  assert.match(html, /Qual é o código de barras\?/);
  assert.match(html, /Precisamos desta informação/);
  assert.match(html, /data-mission-body="input"/);
  assert.match(html, /Confirmar/);
  assert.match(html, /Cancelar/);
});

test("Mission confirm: usa ConfirmBody (Sim/Não/Cancelar), sem rodapé genérico", () => {
  const payload: MissionPayload = { id: "m2", type: "confirm", title: "Confirmar publicação?", body: { kind: "confirm" } };
  const html = render({ payload, state: "active" });
  assert.match(html, /role="dialog"/);
  assert.match(html, /data-mission-body="confirm"/);
  assert.match(html, /Sim/);
  assert.match(html, /Não/);
});
