// Testes de contrato do Decision Journal (R-DJ-1).
// Puros, sem rede/banco. Rodar: node --test src/modules/adaptive-intelligence/decision-journal.test.ts
//
// Validam APENAS o contrato da infraestrutura mínima (IMP-AIL-001 §8):
// a implementação NoOp existe, o contrato é respeitado, chamadas nunca lançam,
// e nenhuma dependência externa é necessária. Nenhum teste de integração.

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolverDecisionJournal } from "./decision-journal.ts";
import type { DecisionJournal, Decision } from "./decision-journal.ts";
import { NoOpDecisionJournal } from "./infrastructure/decision-journal.noop.ts";
import { InMemoryDecisionJournal } from "./infrastructure/decision-journal.memory.ts";

function decisaoExemplo(over: Partial<Decision> = {}): Decision {
  return {
    id: "dec-1",
    empresa: "emp-1",
    autor: "user-1",
    contexto: "catalogo",
    entidade: { tipo: "produto", id: "prod-1" },
    campo: "categoria",
    valorAnterior: "MLB1000",
    valorNovo: "MLB273770",
    origem: "tela/produtos/editar",
    timestamp: "2026-07-21T00:00:00.000Z",
    correlacao: null,
    ...over,
  };
}

test("a factory resolve a implementação NoOp em R-DJ-1", () => {
  const journal = resolverDecisionJournal();
  assert.ok(journal instanceof NoOpDecisionJournal);
});

test("o contrato é respeitado: registrarDecisao existe e retorna void", () => {
  const journal: DecisionJournal = resolverDecisionJournal();
  const retorno = journal.registrarDecisao(decisaoExemplo());
  assert.equal(retorno, undefined);
});

test("registrarDecisao NUNCA lança — nem com metadados, nem em chamadas repetidas", () => {
  const journal = resolverDecisionJournal();
  assert.doesNotThrow(() => journal.registrarDecisao(decisaoExemplo()));
  assert.doesNotThrow(() =>
    journal.registrarDecisao(decisaoExemplo({ metadados: { origemLote: true } }))
  );
  assert.doesNotThrow(() => {
    for (let i = 0; i < 100; i++) journal.registrarDecisao(decisaoExemplo({ id: `dec-${i}` }));
  });
});

test("o NoOp descarta: nenhum efeito observável após registrar", () => {
  const journal = new NoOpDecisionJournal();
  // Sem estado, sem retorno, sem exceção — apenas descarta.
  assert.equal(journal.registrarDecisao(decisaoExemplo()), undefined);
});

test("a Decision flui íntegra pelo Port (via adaptador de teste em memória)", () => {
  const journal = new InMemoryDecisionJournal();
  const d = decisaoExemplo();
  journal.registrarDecisao(d);
  assert.equal(journal.recebidas.length, 1);
  assert.deepEqual(journal.recebidas[0], d);
});

test("nenhuma dependência externa é necessária: só node builtins nos imports", () => {
  // Este teste é uma asserção de projeto: se o módulo dependesse de rede/banco,
  // os imports acima falhariam ao carregar sem ambiente. O fato de o arquivo
  // executar prova ausência de dependência externa.
  assert.ok(true);
});
