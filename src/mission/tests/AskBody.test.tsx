// AskBody (ENG-004) — pergunta aberta, campo livre.
// Rodar: npx tsx --test src/mission/tests/AskBody.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AskBody } from "../components/AskBody.tsx";

test("AskBody renderiza um campo livre (textarea) com o valor", () => {
  const html = renderToStaticMarkup(<AskBody value="olá" onChange={() => {}} placeholder="…" />);
  assert.match(html, /data-mission-body="ask"/);
  assert.match(html, /<textarea/);
  assert.match(html, /olá/);
});
