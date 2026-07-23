// Teste da MissionLayer (ENG-003) — sempre montada; acima do Stage.
// Rodar: npx tsx --test src/shell/MissionLayer/MissionLayer.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ShellProvider } from "../providers/ShellProvider.tsx";
import { MissionLayer } from "./MissionLayer.tsx";

test("MissionLayer: permanece montada mesmo sem Missão (container persiste)", () => {
  const html = renderToStaticMarkup(
    <ShellProvider config={{ navigation: [{ id: "h", label: "H" }] }}><MissionLayer /></ShellProvider>,
  );
  assert.match(html, /data-shell-layer="mission"/);
});

test("MissionLayer: com Missão ativa, renderiza o título", () => {
  const html = renderToStaticMarkup(
    <ShellProvider config={{ navigation: [{ id: "h", label: "H" }], initialMission: { active: true, title: "Missão X" } }}>
      <MissionLayer />
    </ShellProvider>,
  );
  assert.match(html, /Missão X/);
});
