// InputBody (ENG-004) — entrada estruturada; nunca valida domínio.
// Rodar: npx tsx --test src/mission/tests/InputBody.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { InputBody } from "../components/InputBody.tsx";

test("InputBody renderiza input do tipo pedido (text/number/date)", () => {
  for (const t of ["text", "number", "date"] as const) {
    const html = renderToStaticMarkup(<InputBody value="" onChange={() => {}} inputType={t} />);
    assert.match(html, new RegExp(`type="${t}"`));
    assert.match(html, /data-mission-body="input"/);
  }
});
