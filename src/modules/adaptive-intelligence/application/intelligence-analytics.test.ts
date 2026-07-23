// Testes da Intelligence Analytics (E5.5).
//
// Cobrem: plataforma vazia, plataforma saudável, disputas, promotion
// readiness (bloqueios agrupados), outcomes/offers, explainability
// (metodologia sempre presente), determinismo e serializabilidade.
// Analytics nunca altera nada — todos os testes são de leitura pura.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/intelligence-analytics.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Padrao } from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import { evoluirConfidence } from "./confidence-evolution.ts";
import { avaliarPromocao } from "./promotion-readiness.ts";
import {
  gerarAnalyticsEmpresa,
  montarAnalytics,
} from "./intelligence-analytics.ts";

function padrao(p: Partial<Padrao> & { id: string; valorNovo: string }): Padrao {
  return {
    chave: JSON.stringify(["cli-01", "catalogo", "categoriaMarketplace", p.valorNovo]),
    empresa: "cli-01",
    contexto: "catalogo",
    campo: "categoriaMarketplace",
    ocorrencias: 1,
    decisoesDeSuporte: [],
    primeiraOcorrencia: "2026-07-01T10:00:00.000Z",
    ultimaOcorrencia: "2026-07-20T10:00:00.000Z",
    confidence: "observado",
    estado: "emergente",
    slotEstado: "emergente",
    ...p,
  };
}

function outcome(o: {
  outcomeId: string;
  status: Outcome["status"];
  decisionId?: string;
  patternId?: string;
}): Outcome {
  return {
    outcomeId: o.outcomeId,
    offerId: o.outcomeId.replace("otc:", ""),
    empresaId: "cli-01",
    slot: { contexto: "catalogo", campo: "categoriaMarketplace" },
    entidade: null,
    status: o.status,
    decisionId: o.decisionId ?? null,
    author: o.decisionId ? "ana@zion.com" : null,
    respondedAt: o.decisionId ? "2026-07-22T10:05:00.000Z" : null,
    responseTimeMs: o.decisionId ? 1000 : null,
    evidence: {
      valorOferecido: "MLB273770",
      valorDecidido: o.decisionId ? "MLB273770" : null,
      diferenca: o.decisionId ? (o.status === "confirmed" ? "nenhuma" : "valor_alterado") : null,
      patternId: o.patternId ?? "pat-a",
      confidenceNaOferta: "consistente",
      respostasSubsequentes: 0,
    },
    explanation: "teste",
  };
}

const P_CONSISTENTE = padrao({
  id: "pat-a", valorNovo: "MLB273770", ocorrencias: 3,
  decisoesDeSuporte: ["d1", "d2", "d3"], confidence: "consistente",
  estado: "estabelecido", slotEstado: "consistente",
});
const P_DISPUTADO = padrao({
  id: "pat-b", valorNovo: "MLB999999", campo: "tipoAnuncio", contexto: "publicacao",
  ocorrencias: 2, decisoesDeSuporte: ["e1", "e2"], confidence: "recorrente",
  slotEstado: "em_disputa",
});

function compor(padroes: Padrao[], outcomes: Outcome[]) {
  const evolucoes = padroes.map((p) => evoluirConfidence(p, padroes, outcomes));
  const avaliacoes = padroes.map((p, i) => avaliarPromocao(p, evolucoes[i], outcomes));
  return montarAnalytics(padroes, outcomes, evolucoes, avaliacoes);
}

test("plataforma vazia: zeros honestos em todas as seções", () => {
  const a = compor([], []);
  assert.equal(a.patterns.total, 0);
  assert.equal(a.offers.emitidas, 0);
  assert.equal(a.outcomes.confirmed + a.outcomes.modified + a.outcomes.pending, 0);
  assert.equal(a.promotionReadiness.estruturalmenteElegiveis, 0);
  assert.deepEqual(a.promotionReadiness.bloqueiosPorMotivo, []);
  assert.ok(a.health.fatos.length > 0); // saúde relata mesmo o vazio
});

test("plataforma saudável: consistente + outcome modificado → elegível contado", () => {
  const modificado = outcome({ outcomeId: "otc:1", status: "modified", decisionId: "d9" });
  const a = compor([P_CONSISTENTE], [modificado]);
  assert.equal(a.patterns.consistentes, 1);
  assert.equal(a.patterns.sobreviventesAposEvolution, 1);
  assert.equal(a.promotionReadiness.estruturalmenteElegiveis, 1);
  assert.match(a.health.fatos[4], /prontos para promoção: 1/);
});

test("disputas aparecem em patterns e nos bloqueios agrupados", () => {
  const a = compor([P_CONSISTENTE, P_DISPUTADO], []);
  assert.equal(a.patterns.disputados, 1);
  const disputa = a.promotionReadiness.bloqueiosPorMotivo.find((b) => b.motivo === "slot_em_disputa");
  assert.equal(disputa?.quantidade, 1);
  // O bloqueio da ADR-002 vale para TODOS, por construção (honestidade):
  const adr = a.promotionReadiness.bloqueiosPorMotivo.find(
    (b) => b.motivo === "decisao_de_promocao_indefinida_adr_002"
  );
  assert.equal(adr?.quantidade, 2);
});

test("offers/outcomes: 1 oferta → 1 outcome; respondidas = confirmed+modified", () => {
  const os = [
    outcome({ outcomeId: "otc:1", status: "confirmed", decisionId: "d3" }),
    outcome({ outcomeId: "otc:2", status: "modified", decisionId: "d9" }),
    outcome({ outcomeId: "otc:3", status: "pending" }),
  ];
  const a = compor([P_CONSISTENTE], os);
  assert.equal(a.offers.emitidas, 3);
  assert.equal(a.offers.respondidas, 2);
  assert.equal(a.offers.pendentes, 1);
  assert.deepEqual(a.outcomes, { confirmed: 1, modified: 1, pending: 1 });
});

test("confidence: rebaixada pelo desconto entra em rebaixadas e sai de estáveis", () => {
  const consumida = outcome({ outcomeId: "otc:1", status: "confirmed", decisionId: "d3" });
  const a = compor([P_CONSISTENTE], [consumida]);
  assert.equal(a.confidence.rebaixadas, 1); // 3→2 independentes
  assert.equal(a.confidence.estaveis, 0);
  assert.equal(a.patterns.sobreviventesAposEvolution, 0);
});

test("explainability: metodologia presente em TODAS as seções, origem nunca escondida", () => {
  const a = compor([P_CONSISTENTE], []);
  for (const secao of ["patterns", "offers", "outcomes", "confidence", "promotionReadiness", "health"] as const) {
    assert.ok(a.metodologia[secao].length > 0, `metodologia de ${secao}`);
  }
  assert.match(a.metodologia.patterns, /E5\.3/);
  assert.match(a.metodologia.health, /sem nota, sem score/);
});

test("determinismo: mesmos fatos → mesmo Analytics (ordem irrelevante)", () => {
  const os = [
    outcome({ outcomeId: "otc:1", status: "modified", decisionId: "d9" }),
    outcome({ outcomeId: "otc:2", status: "pending" }),
  ];
  const a = compor([P_CONSISTENTE, P_DISPUTADO], os);
  const b = compor([P_DISPUTADO, P_CONSISTENTE].reverse(), [...os].reverse());
  // As contagens não dependem de ordem de entrada:
  assert.deepEqual(a.patterns, b.patterns);
  assert.deepEqual(a.outcomes, b.outcomes);
  assert.deepEqual(a.promotionReadiness, b.promotionReadiness);
});

test("serializável: JSON puro, roundtrip sem perda", () => {
  const a = compor([P_CONSISTENTE], [outcome({ outcomeId: "otc:1", status: "pending" })]);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), a);
});

test("gerarAnalyticsEmpresa: carrega cada fonte uma vez e compõe (leitura pura)", async () => {
  const repos = {
    leitura: {
      padroes: { listar: async () => [P_CONSISTENTE] },
      decisoes: { listar: async () => [] },
    },
    observacao: {
      ofertas: { listar: async () => [] },
      padroes: { listar: async () => [] },
      decisoes: { listar: async () => [] },
    },
  };
  const a = await gerarAnalyticsEmpresa("cli-01", repos);
  assert.equal(a.patterns.total, 1);
  assert.deepEqual(a, await gerarAnalyticsEmpresa("cli-01", repos)); // idempotente
});
