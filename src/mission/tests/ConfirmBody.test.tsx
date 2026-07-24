// ConfirmBody (ENG-004) — Sim / Não / Cancelar.
// Rodar: npx tsx --test src/mission/tests/ConfirmBody.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmBody } from "../components/ConfirmBody.tsx";

test("ConfirmBody renderiza exatamente Sim, Não e Cancelar", () => {
  const html = renderToStaticMarkup(<ConfirmBody onYes={() => {}} onNo={() => {}} onCancel={() => {}} />);
  assert.match(html, /data-mission-body="confirm"/);
  assert.match(html, /Sim/);
  assert.match(html, /Não/);
  assert.match(html, /Cancelar/);
  assert.equal((html.match(/<button/g) ?? []).length, 3);
});
