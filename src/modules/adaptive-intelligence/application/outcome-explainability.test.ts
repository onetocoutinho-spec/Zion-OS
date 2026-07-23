// Testes da Outcome Explainability (E5.2).
//
// Cobrem: os três status, a cadeia completa de evidências (Offer→Observation→
// Outcome), determinismo, autor correto, Offer ausente (mismatch → null),
// Decision ausente (pending → resposta null), serializabilidade (JSON puro) e
// a nota de auto-reforço derivada do próprio Outcome. Zero escrita.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/outcome-explainability.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "../domain/decision.ts";
import { AUTOR_OFERTA, VERSAO_CONTRATO_OFERTA, type Oferta } from "../domain/offer.ts";
import { projetarOutcome } from "./outcome-projection.ts";
import {
  explicarOutcome,
  explicarOutcomes,
  NOTA_AUTO_REFORCO,
} from "./outcome-explainability.ts";
import type { ReposObservacao } from "./offer-observation.ts";

function oferta(o: Partial<Oferta> & { id: string }): Oferta {
  return {
    oferecidaEm: "2026-07-22T10:00:00.000Z",
    empresa: "cli-01",
    contexto: "catalogo",
    campo: "categoriaMarketplace",
    entidade: { tipo: "produto", id: "prd-01" },
    patternId: "pat-a",
    valorOferecido: "MLB273770",
    confidenceUtilizada: "consistente",
    ocorrenciasNoMomento: 3,
    autorDaOferta: AUTOR_OFERTA,
    versaoContrato: VERSAO_CONTRATO_OFERTA,
    origemExplicacao: "explicarConfidence(RFC-AIL-004 §4.3/§4.4)",
    correlacao: null,
    ...o,
  };
}

function decisao(d: Partial<Decision> & { id: string; timestamp: string }): Decision {
  return {
    empresa: "cli-01",
    autor: "ana@zion.com",
    contexto: "catalogo",
    entidade: { tipo: "produto", id: "prd-01" },
    campo: "categoriaMarketplace",
    valorAnterior: null,
    valorNovo: "MLB273770",
    origem: "produtos.atualizarProduto",
    correlacao: null,
    ...d,
  };
}

const OFERTA = oferta({ id: "ofr-1" });
const IGUAL = decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z" });
const DIFERENTE = decisao({ id: "d2", timestamp: "2026-07-22T10:05:00.000Z", valorNovo: "MLB999999" });

test("confirmed: origem + resposta + comparação + nota de auto-reforço", () => {
  const exp = explicarOutcome(projetarOutcome(OFERTA, [IGUAL]), OFERTA);
  assert.ok(exp);
  // Origem — quem falou, quando, sob qual contrato
  assert.equal(exp.origem.autorDaOferta, AUTOR_OFERTA);
  assert.equal(exp.origem.criadaEm, "2026-07-22T10:00:00.000Z");
  assert.equal(exp.origem.versaoContrato, VERSAO_CONTRATO_OFERTA);
  assert.equal(exp.origem.confidenceCongelada, "consistente");
  // Resposta — quem respondeu, quando, quanto tempo
  assert.equal(exp.resposta?.autor, "ana@zion.com");
  assert.equal(exp.resposta?.tempoAteRespostaMs, 5 * 60 * 1000);
  // Comparação
  assert.equal(exp.comparacao.iguais, true);
  assert.equal(exp.comparacao.diferenca, "nenhuma");
  // Auto-reforço — derivado do status, texto oficial
  assert.equal(exp.notaAutoReforco, NOTA_AUTO_REFORCO);
});

test("modified: comparação explícita e SEM nota de auto-reforço", () => {
  const exp = explicarOutcome(projetarOutcome(OFERTA, [DIFERENTE]), OFERTA);
  assert.ok(exp);
  assert.equal(exp.status, "modified");
  assert.equal(exp.comparacao.valorOferecido, "MLB273770");
  assert.equal(exp.comparacao.valorDecidido, "MLB999999");
  assert.equal(exp.comparacao.iguais, false);
  assert.equal(exp.notaAutoReforco, null);
});

test("pending: Decision ausente → resposta null, comparação em aberto", () => {
  const exp = explicarOutcome(projetarOutcome(OFERTA, []), OFERTA);
  assert.ok(exp);
  assert.equal(exp.status, "pending");
  assert.equal(exp.resposta, null);
  assert.equal(exp.comparacao.iguais, null);
  assert.match(exp.cadeiaDeEvidencias[1], /nenhuma Decision posterior/);
});

test("cadeia completa: Offer → Observation → Outcome, sempre em 3 elos", () => {
  const exp = explicarOutcome(projetarOutcome(OFERTA, [IGUAL, DIFERENTE]), OFERTA);
  assert.ok(exp);
  assert.equal(exp.cadeiaDeEvidencias.length, 3);
  assert.match(exp.cadeiaDeEvidencias[0], /^Offer ofr-1/); // o fato
  assert.match(exp.cadeiaDeEvidencias[1], /^Observation \(E5\.0\)/); // a observação
  assert.match(exp.cadeiaDeEvidencias[1], /\+1 subsequente/); // nada escondido
  assert.match(exp.cadeiaDeEvidencias[2], /^Outcome \(E5\.1\)/); // a projeção
});

test("Offer ausente (mismatch de id) → null — explicação sem origem não existe", () => {
  const outra = oferta({ id: "ofr-OUTRA" });
  assert.equal(explicarOutcome(projetarOutcome(OFERTA, []), outra), null);
});

test("determinismo: mesmos fatos → exatamente a mesma explicação", () => {
  const a = explicarOutcome(projetarOutcome(OFERTA, [IGUAL]), OFERTA);
  const b = explicarOutcome(projetarOutcome(OFERTA, [IGUAL]), OFERTA);
  assert.deepEqual(a, b);
});

test("serializável: JSON puro, roundtrip sem perda", () => {
  const exp = explicarOutcome(projetarOutcome(OFERTA, [IGUAL]), OFERTA);
  assert.deepEqual(JSON.parse(JSON.stringify(exp)), exp); // zero React, zero função
});

test("explicarOutcomes: join pelos logs, uma explicação por oferta", async () => {
  const o2 = oferta({ id: "ofr-2", oferecidaEm: "2026-07-22T11:00:00.000Z", entidade: null });
  const repos: ReposObservacao = {
    ofertas: { listar: async () => [OFERTA, o2] },
    padroes: { listar: async () => [] },
    decisoes: { listar: async () => [IGUAL] },
  };
  const explicacoes = await explicarOutcomes("cli-01", repos);
  assert.equal(explicacoes.length, 2);
  const porOferta = new Map(explicacoes.map((e) => [e.origem.offerId, e.status]));
  assert.equal(porOferta.get("ofr-1"), "confirmed");
  assert.equal(porOferta.get("ofr-2"), "pending");
});

test("autor anônimo na resposta chega rotulado ('não registrado')", () => {
  const anonima = decisao({ id: "d9", timestamp: "2026-07-22T10:05:00.000Z", autor: "" });
  const exp = explicarOutcome(projetarOutcome(OFERTA, [anonima]), OFERTA);
  assert.equal(exp?.resposta?.autor, "não registrado");
});
