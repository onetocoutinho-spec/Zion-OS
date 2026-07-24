// ChoiceBody (ENG-004) — escolha entre alternativas; nunca interpreta.
// Rodar: npx tsx --test src/mission/tests/ChoiceBody.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ChoiceBody } from "../components/ChoiceBody.tsx";

test("ChoiceBody renderiza as opções como radios e marca a selecionada", () => {
  const html = renderToStaticMarkup(
    <ChoiceBody options={[{ id: "a", label: "Alfa" }, { id: "b", label: "Beta" }]} value="b" onSelect={() => {}} />,
  );
  assert.match(html, /role="radiogroup"/);
  assert.equal((html.match(/role="radio"/g) ?? []).length, 2);
  assert.match(html, /Alfa/);
  assert.match(html, /Beta/);
  assert.match(html, /aria-checked="true"/); // a selecionada
});
