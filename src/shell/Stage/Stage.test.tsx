// Teste do Stage (ENG-003) — aceita Contexto vazio; hospeda conteúdo por contrato.
// Rodar: npx tsx --test src/shell/Stage/Stage.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ShellProvider } from "../providers/ShellProvider.tsx";
import { Stage } from "./Stage.tsx";

test("Stage: Contexto vazio → placeholder (aceita vazio)", () => {
  const html = renderToStaticMarkup(
    <ShellProvider config={{ navigation: [{ id: "hoje", label: "Hoje" }], initialContext: "hoje" }}>
      <Stage />
    </ShellProvider>,
  );
  assert.match(html, /sem conteúdo/);
});

test("Stage: Contexto com StageContent → renderiza o conteúdo do contrato", () => {
  const html = renderToStaticMarkup(
    <ShellProvider config={{ navigation: [{ id: "hoje", label: "Hoje" }], initialContext: "hoje", contents: [{ contextId: "hoje", node: <b data-c="x" /> }] }}>
      <Stage />
    </ShellProvider>,
  );
  assert.match(html, /data-c="x"/);
});
