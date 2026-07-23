// useMission + MissionProvider (ENG-004) — porta de acesso, isolada.
// Rodar: npx tsx --test src/mission/tests/useMission.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { MissionProvider } from "../provider/MissionProvider.tsx";
import { useMission } from "../hooks/useMission.ts";

function Probe() {
  const m = useMission();
  return <span data-has={[typeof m.open, typeof m.close, typeof m.emitIntent, typeof m.clear].join(",")} data-mission={String(m.mission)} />;
}

test("useMission lança fora do MissionProvider (só por contrato)", () => {
  assert.throws(() => renderToStaticMarkup(<Probe />), /MissionProvider/);
});

test("useMission expõe exclusivamente mission/open/close/emitIntent/clear; começa oculto", () => {
  const html = renderToStaticMarkup(<MissionProvider><Probe /></MissionProvider>);
  assert.match(html, /data-has="function,function,function,function"/);
  assert.match(html, /data-mission="null"/);
});
