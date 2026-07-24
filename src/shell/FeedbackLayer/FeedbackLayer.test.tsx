// Teste da FeedbackLayer (ENG-003) — sempre montada; overlay que não altera layout.
// Rodar: npx tsx --test src/shell/FeedbackLayer/FeedbackLayer.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ShellProvider } from "../providers/ShellProvider.tsx";
import { FeedbackLayer } from "./FeedbackLayer.tsx";

test("FeedbackLayer: permanece montada; idle não mostra mensagem", () => {
  const html = renderToStaticMarkup(
    <ShellProvider config={{ navigation: [{ id: "h", label: "H" }] }}><FeedbackLayer /></ShellProvider>,
  );
  assert.match(html, /data-shell-layer="feedback"/);
  assert.doesNotMatch(html, /Carregando|Executando|Concluído|Erro/);
});

test("FeedbackLayer: pinta Loading/Running/Completed/Error sem conhecer Capabilities", () => {
  for (const [kind, label] of [["loading", "Carregando"], ["running", "Executando"], ["completed", "Concluído"], ["error", "Erro"]] as const) {
    const html = renderToStaticMarkup(
      <ShellProvider config={{ navigation: [{ id: "h", label: "H" }], initialFeedback: { kind } }}>
        <FeedbackLayer />
      </ShellProvider>,
    );
    assert.match(html, new RegExp(label));
  }
});
