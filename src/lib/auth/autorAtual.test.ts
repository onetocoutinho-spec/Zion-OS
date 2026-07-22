// Testes da autoria das Decisions (E4.2.3).
//
// (1) O extrator PURO `autorDaSessao` — a lógica de identidade completa;
// (2) `autorAtual` em ambiente sem Supabase → "" (retrocompatibilidade demo);
// (3) `capturarDecisao` propaga o autor até a Decision registrada — o caminho
//     que todos os producers usam via spread `{ ...captura, autor }`.
// Rodar: npx tsx --test src/lib/auth/autorAtual.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { autorAtual, autorDaSessao } from "./autorAtual.ts";
import { capturarDecisao } from "../../modules/adaptive-intelligence/decision-journal.ts";
import { InMemoryDecisionJournal } from "../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

test("autorDaSessao: e-mail é o identificador canônico", () => {
  assert.equal(
    autorDaSessao({ user: { email: "equipe@zion.com", id: "uuid-1" } }),
    "equipe@zion.com"
  );
});

test("autorDaSessao: sem e-mail → id do usuário; sem nada → vazio", () => {
  assert.equal(autorDaSessao({ user: { email: null, id: "uuid-2" } }), "uuid-2");
  assert.equal(autorDaSessao({ user: null }), "");
  assert.equal(autorDaSessao(null), "");
  assert.equal(autorDaSessao(undefined), "");
});

test("autorAtual: sem Supabase (demo/testes) → '' e nunca lança", async () => {
  assert.equal(await autorAtual(), "");
});

test("capturarDecisao propaga o autor até a Decision registrada", () => {
  const journal = new InMemoryDecisionJournal();
  capturarDecisao(
    {
      empresa: "cli-01",
      contexto: "catalogo",
      entidade: { tipo: "produto", id: "prd-01" },
      campo: "categoriaMarketplace",
      valorAnterior: "MLB111111",
      valorNovo: "MLB273770",
      origem: "teste.autoria",
      autor: "equipe@zion.com",
    },
    journal
  );
  assert.equal(journal.recebidas.length, 1);
  assert.equal(journal.recebidas[0].autor, "equipe@zion.com");
});

test("retrocompatibilidade: captura sem autor → Decision com autor ''", () => {
  const journal = new InMemoryDecisionJournal();
  capturarDecisao(
    {
      empresa: "cli-01",
      contexto: "catalogo",
      entidade: { tipo: "produto", id: "prd-01" },
      campo: "categoriaMarketplace",
      valorAnterior: null,
      valorNovo: "MLB273770",
      origem: "teste.autoria",
    },
    journal
  );
  assert.equal(journal.recebidas[0].autor, "");
});
