// Testes de capturarDecisao() — a fronteira de captura das Signal Sources (PR-004).
//
// Verificam: preenchimento do que a fonte não conhece (id/timestamp/defaults),
// o Princípio da Captura Significativa na fronteira (sem delta → não captura;
// valor vazio → não captura) e o fire-and-forget absoluto (Journal que lança
// não escapa; caminho padrão via Factory não lança).
// Rodar: npx tsx --test src/modules/adaptive-intelligence/capturar-decisao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { capturarDecisao, type CapturaDeDecisao } from "./decision-journal.ts";
import type { DecisionJournal } from "./decision-journal.ts";
import { InMemoryDecisionJournal } from "./infrastructure/decision-journal.memory.ts";

function captura(over: Partial<CapturaDeDecisao> = {}): CapturaDeDecisao {
  return {
    empresa: "cli-01",
    contexto: "catalogo",
    entidade: { tipo: "produto", id: "prd-01" },
    campo: "categoriaMarketplace",
    valorAnterior: "MLB1000",
    valorNovo: "MLB273770",
    origem: "produtos.atualizarProduto",
    ...over,
  };
}

test("completa a Decision: id gerado, timestamp ISO, autor/correlacao default", () => {
  const journal = new InMemoryDecisionJournal();
  capturarDecisao(captura(), journal);
  assert.equal(journal.recebidas.length, 1);
  const d = journal.recebidas[0];
  assert.ok(d.id.length > 0);
  assert.ok(!Number.isNaN(Date.parse(d.timestamp)));
  assert.equal(d.autor, "");
  assert.equal(d.correlacao, null);
  assert.equal(d.campo, "categoriaMarketplace");
  assert.equal(d.valorAnterior, "MLB1000");
  assert.equal(d.valorNovo, "MLB273770");
});

test("captura significativa: SEM delta (anterior === novo) → não captura", () => {
  const journal = new InMemoryDecisionJournal();
  capturarDecisao(captura({ valorAnterior: "MLB273770", valorNovo: "MLB273770" }), journal);
  assert.equal(journal.recebidas.length, 0);
});

test("captura significativa: valorNovo vazio ou só espaços → não captura", () => {
  const journal = new InMemoryDecisionJournal();
  capturarDecisao(captura({ valorNovo: "" }), journal);
  capturarDecisao(captura({ valorNovo: "   " }), journal);
  assert.equal(journal.recebidas.length, 0);
});

test("fire-and-forget: Journal que LANÇA não escapa da captura", () => {
  const jornalQueLanca: DecisionJournal = {
    registrarDecisao() {
      throw new Error("falha simulada");
    },
  };
  assert.doesNotThrow(() => capturarDecisao(captura(), jornalQueLanca));
});

test("caminho padrão (Factory, sem injeção) não lança", () => {
  assert.doesNotThrow(() => capturarDecisao(captura()));
});

test("autor e correlacao fornecidos pela fonte são preservados", () => {
  const journal = new InMemoryDecisionJournal();
  capturarDecisao(captura({ autor: "ana@zion.com", correlacao: "lote-7" }), journal);
  assert.equal(journal.recebidas[0].autor, "ana@zion.com");
  assert.equal(journal.recebidas[0].correlacao, "lote-7");
});
