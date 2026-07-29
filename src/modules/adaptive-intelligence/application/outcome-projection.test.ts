// Testes da Outcome Projection (E5.1).
//
// Cobrem o critério de sucesso: pending/confirmed/modified, explainability
// completa, responseTime, DETERMINISMO (mesmos fatos → mesmo Outcome),
// idempotência, oferta/decision inexistentes, múltiplas ofertas e a regra do
// auto-reforço declarada no próprio Outcome. 100% puro, zero persistência.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/outcome-projection.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "../domain/decision.ts";
import { AUTOR_OFERTA, VERSAO_CONTRATO_OFERTA, type Oferta } from "../domain/offer.ts";
import { outcomeIdDe } from "../domain/outcome.ts";
import { projetarOutcome, projetarOutcomes } from "./outcome-projection.ts";
import type { ReposObservacao } from "./offer-observation.ts";

function oferta(o: Partial<Oferta> & { id: string }): Oferta {
  const base = {
    id: o.id,
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
    // Faltavam TRÊS campos, não um. O `...o` no fim tornava tudo opcional aos
    // olhos do TS, e o fixture montava uma Oferta que o contrato não aceita.
    versaoEngine: null,
    versaoConfidence: null,
    versaoExplainability: null,
    correlacao: null,
  } satisfies Oferta;
  // `satisfies` na BASE é a garantia que importa: campo novo obrigatório em
  // Oferta quebra a compilação aqui. O cast cobre só a mesclagem, porque
  // `Partial<T>` reintroduz `undefined` em cada chave sem
  // `exactOptionalPropertyTypes` — limitação do TS, não do fixture.
  return { ...base, ...o } as Oferta;
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
const RESPOSTA_IGUAL = decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z" });
const RESPOSTA_DIFERENTE = decisao({
  id: "d2",
  timestamp: "2026-07-22T10:05:00.000Z",
  valorNovo: "MLB999999",
});

test("sem resposta → pending, com explicação honesta (nunca expira por relógio)", () => {
  const o = projetarOutcome(OFERTA, []);
  assert.equal(o.status, "pending");
  assert.equal(o.decisionId, null);
  assert.equal(o.author, null);
  assert.equal(o.responseTimeMs, null);
  assert.equal(o.evidence.diferenca, null);
  assert.match(o.explanation, /pending nunca expira/);
});

test("resposta igual → confirmed + regra do auto-reforço declarada no Outcome", () => {
  const o = projetarOutcome(OFERTA, [RESPOSTA_IGUAL]);
  assert.equal(o.status, "confirmed");
  assert.equal(o.decisionId, "d1");
  assert.equal(o.evidence.diferenca, "nenhuma");
  assert.match(o.explanation, /NÃO é evidência independente/); // E5.3 a descontará
});

test("resposta diferente → modified, com a diferença explícita", () => {
  const o = projetarOutcome(OFERTA, [RESPOSTA_DIFERENTE]);
  assert.equal(o.status, "modified");
  assert.equal(o.evidence.valorOferecido, "MLB273770");
  assert.equal(o.evidence.valorDecidido, "MLB999999");
  assert.equal(o.evidence.diferenca, "valor_alterado");
  assert.match(o.explanation, /modificou a oferta/);
});

test("explainability completa: todo campo do critério tem resposta", () => {
  const o = projetarOutcome(OFERTA, [RESPOSTA_IGUAL]);
  assert.equal(o.offerId, "ofr-1"); // qual Offer originou
  assert.equal(o.decisionId, "d1"); // qual Decision respondeu
  assert.equal(o.author, "ana@zion.com"); // qual operador
  assert.equal(o.evidence.valorOferecido, "MLB273770"); // valor oferecido
  assert.equal(o.evidence.valorDecidido, "MLB273770"); // valor decidido
  assert.equal(o.responseTimeMs, 5 * 60 * 1000); // quanto tempo levou
  assert.ok(o.explanation.length > 0); // por que este status
  assert.deepEqual(o.slot, { contexto: "catalogo", campo: "categoriaMarketplace" });
  assert.equal(o.evidence.patternId, "pat-a");
  assert.equal(o.evidence.confidenceNaOferta, "consistente"); // congelada na oferta
});

test("determinismo: mesmos fatos → EXATAMENTE o mesmo Outcome", () => {
  const a = projetarOutcome(OFERTA, [RESPOSTA_IGUAL, RESPOSTA_DIFERENTE]);
  const b = projetarOutcome(OFERTA, [RESPOSTA_DIFERENTE, RESPOSTA_IGUAL]); // outra ordem
  assert.deepEqual(a, b); // confluência: independe da ordem de entrada
  assert.equal(a.outcomeId, outcomeIdDe("ofr-1")); // id determinístico
});

test("idempotência: projetar N vezes não muda nada e não escreve nada", async () => {
  const repos: ReposObservacao = {
    ofertas: { listar: async () => [OFERTA] },
    padroes: { listar: async () => [] },
    decisoes: { listar: async () => [RESPOSTA_IGUAL] },
  };
  const r1 = await projetarOutcomes("cli-01", repos);
  const r2 = await projetarOutcomes("cli-01", repos);
  assert.deepEqual(r1, r2);
});

test("sem ofertas (offer 'inexistente') → projeção vazia", async () => {
  const repos: ReposObservacao = {
    ofertas: { listar: async () => [] },
    padroes: { listar: async () => [] },
    decisoes: { listar: async () => [RESPOSTA_IGUAL] },
  };
  assert.deepEqual(await projetarOutcomes("cli-01", repos), []);
});

test("Journal vazio (decision 'inexistente') → todos pending", async () => {
  const repos: ReposObservacao = {
    ofertas: { listar: async () => [OFERTA, oferta({ id: "ofr-2" })] },
    padroes: { listar: async () => [] },
    decisoes: { listar: async () => [] },
  };
  const outcomes = await projetarOutcomes("cli-01", repos);
  assert.equal(outcomes.length, 2);
  assert.ok(outcomes.every((o) => o.status === "pending"));
});

test("múltiplas ofertas: cada uma projeta seu próprio Outcome", async () => {
  const o2 = oferta({
    id: "ofr-2",
    oferecidaEm: "2026-07-22T11:00:00.000Z",
    entidade: { tipo: "produto", id: "prd-02" },
  });
  const repos: ReposObservacao = {
    ofertas: { listar: async () => [OFERTA, o2] },
    padroes: { listar: async () => [] },
    decisoes: { listar: async () => [RESPOSTA_IGUAL] }, // responde só a prd-01
  };
  const outcomes = await projetarOutcomes("cli-01", repos);
  const porOferta = new Map(outcomes.map((o) => [o.offerId, o.status]));
  assert.equal(porOferta.get("ofr-1"), "confirmed");
  assert.equal(porOferta.get("ofr-2"), "pending");
});
