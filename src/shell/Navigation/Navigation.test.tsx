// Teste da Navigation (ENG-003) — renderiza só Contextos, marca o ativo.
// Rodar: npx tsx --test src/shell/Navigation/Navigation.test.tsx

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { ShellProvider } from "../providers/ShellProvider.tsx";
import { Navigation } from "./Navigation.tsx";

const cfg = { navigation: [{ id: "hoje", label: "Hoje" }, { id: "catalogo", label: "Catálogo" }], initialContext: "hoje" };

test("Navigation: renderiza todos os Contextos oferecidos", () => {
  const html = renderToStaticMarkup(<ShellProvider config={cfg}><Navigation /></ShellProvider>);
  assert.match(html, /Hoje/);
  assert.match(html, /Catálogo/);
});

test("Navigation: marca o Contexto ativo (aria-current) — o 1º por padrão", () => {
  const html = renderToStaticMarkup(<ShellProvider config={cfg}><Navigation /></ShellProvider>);
  assert.match(html, /aria-current="page"/);
  // exatamente um ativo
  assert.equal((html.match(/aria-current="page"/g) ?? []).length, 1);
});
