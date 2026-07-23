// Teste do Frame (ENG-003) — organiza full-screen, não renderiza conteúdo próprio.
// Rodar: npx tsx --test src/shell/Frame/Frame.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Frame } from "./Frame.tsx";

test("Frame: ocupa toda a tela e apenas organiza (renderiza os filhos que recebe)", () => {
  const html = renderToStaticMarkup(<Frame><i data-x="child" /></Frame>);
  assert.match(html, /100dvh/);
  assert.match(html, /100vw/);
  assert.match(html, /data-x="child"/);
});
