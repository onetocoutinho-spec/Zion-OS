// Testes do Decision Intelligence Center (E5.6) — camada de composição.
//
// Cobrem: dashboard vazio, populado, navegação (ids consistentes entre lista e
// detalhe), explainability presente em cada etapa da linha do tempo, readiness
// sem os termos proibidos, determinismo visual (mesmos fatos → mesma visão) e
// que o analytics embutido é IDÊNTICO ao do E5.5 (nunca recalculado).
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/intelligence-center.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Padrao } from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import { evoluirConfidence } from "./confidence-evolution.ts";
import { avaliarPromocao } from "./promotion-readiness.ts";
import { montarAnalytics } from "./intelligence-analytics.ts";
import {
  carregarPadraoNoCentro,
  carregarVisaoDoCentro,
  comporVisaoDoCentro,
} from "./intelligence-center.ts";

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

function outcome(o: { outcomeId: string; status: Outcome["status"]; decisionId?: string }): Outcome {
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
      patternId: "pat-a",
      confidenceNaOferta: "consistente",
      respostasSubsequentes: 0,
    },
    explanation: "explicação de teste",
  };
}

const P = padrao({
  id: "pat-a", valorNovo: "MLB273770", ocorrencias: 3,
  decisoesDeSuporte: ["d1", "d2", "d3"], confidence: "consistente",
  estado: "estabelecido", slotEstado: "consistente",
});
const OUTCOMES = [
  outcome({ outcomeId: "otc:1", status: "modified", decisionId: "d9" }),
  outcome({ outcomeId: "otc:2", status: "pending" }),
];

test("dashboard vazio: visão existe, com analytics zerado e sem padrões", () => {
  const v = comporVisaoDoCentro([], [], []);
  assert.equal(v.padroes.length, 0);
  assert.equal(v.analytics.patterns.total, 0);
});

test("dashboard populado: cada linha carrega padrão + evolution + readiness + outcomes", () => {
  const v = comporVisaoDoCentro([P], [P], OUTCOMES);
  assert.equal(v.padroes.length, 1);
  const linha = v.padroes[0];
  assert.equal(linha.padrao.id, "pat-a");
  assert.equal(linha.evolution.patternId, "pat-a"); // E5.3
  assert.equal(linha.readiness.patternId, "pat-a"); // E5.4
  assert.equal(linha.outcomes.length, 2); // E5.1
});

test("o analytics embutido é IDÊNTICO ao do E5.5 — nunca recalculado", () => {
  const v = comporVisaoDoCentro([P], [P], OUTCOMES);
  const direto = montarAnalytics(
    [P],
    OUTCOMES,
    [evoluirConfidence(P, [P], OUTCOMES)],
    [avaliarPromocao(P, evoluirConfidence(P, [P], OUTCOMES), OUTCOMES)]
  );
  assert.deepEqual(v.analytics, direto);
});

test("navegação: o id da lista abre o MESMO conteúdo no detalhe", async () => {
  const repos = {
    leitura: { padroes: { listar: async () => [P] }, decisoes: { listar: async () => [] } },
    observacao: {
      ofertas: { listar: async () => [] },
      padroes: { listar: async () => [] },
      decisoes: { listar: async () => [] },
    },
  };
  const visao = await carregarVisaoDoCentro(undefined, repos);
  const detalhe = await carregarPadraoNoCentro(visao.padroes[0].padrao.id, repos);
  assert.ok(detalhe);
  assert.deepEqual(detalhe.padrao, visao.padroes[0].padrao); // sem perda de contexto
  assert.equal(await carregarPadraoNoCentro("pat-zzz", repos), null);
});

test("explainability: toda etapa da linha do tempo tem explicação de origem", () => {
  const v = comporVisaoDoCentro([P], [P], OUTCOMES);
  const l = v.padroes[0];
  assert.ok(l.evolution.explanation.length > 0); // E5.3 explica
  assert.ok(l.readiness.explanation.length > 0); // E5.4 explica
  assert.ok(l.outcomes.every((o) => o.explanation.length > 0)); // E5.1 explica
  assert.ok(Object.values(v.analytics.metodologia).every((m) => m.length > 0)); // E5.5 explica
});

test("termos proibidos: 'promovido'/'confiável' não existem na visão", () => {
  const serializado = JSON.stringify(comporVisaoDoCentro([P], [P], OUTCOMES));
  assert.ok(!serializado.includes('"promovido"'));
  assert.ok(!serializado.includes("confiável\"") && !serializado.includes('"confiavel"'));
});

test("determinismo visual: mesmos fatos → mesma visão (ordem irrelevante)", () => {
  const a = comporVisaoDoCentro([P], [P], OUTCOMES);
  const b = comporVisaoDoCentro([P], [P], [...OUTCOMES].reverse());
  assert.deepEqual(a.analytics, b.analytics);
  assert.deepEqual(a.padroes[0].evolution, b.padroes[0].evolution);
  assert.deepEqual(a.padroes[0].readiness, b.padroes[0].readiness);
});
