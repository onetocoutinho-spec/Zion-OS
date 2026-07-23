// Testes da Promotion Readiness (E5.4).
//
// Cobrem: Pattern consistente (elegível — único bloqueio = ADR-002), Pattern
// disputado, confidence rebaixada pelo desconto, confidence estável, sem
// Outcomes, Outcomes independentes/contados por status, bloqueios corretos,
// explainability completa, determinismo e idempotência. NADA é promovido em
// teste algum — o estado "promovido" não existe nesta camada.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/promotion-readiness.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Padrao } from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import { evoluirConfidence } from "./confidence-evolution.ts";
import {
  avaliarPromocao,
  avaliarPromocoes,
  DEPENDENCIAS_ADR_002,
} from "./promotion-readiness.ts";

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
  id: "pat-a",
  valorNovo: "MLB273770",
  ocorrencias: 3,
  decisoesDeSuporte: ["d1", "d2", "d3"],
  confidence: "consistente",
  estado: "estabelecido",
  slotEstado: "consistente",
});

function avaliar(p: Padrao, todos: Padrao[], outcomes: Outcome[]) {
  return avaliarPromocao(p, evoluirConfidence(p, todos, outcomes), outcomes);
}

test("consistente + estável + outcome modificado → ESTRUTURALMENTE ELEGÍVEL (só resta a ADR-002)", () => {
  const modificado = outcome({ outcomeId: "otc:ofr-1", status: "modified", decisionId: "d9" });
  const r = avaliar(P_CONSISTENTE, [P_CONSISTENTE], [modificado]);
  assert.equal(r.estruturalmenteElegivel, true);
  assert.deepEqual(r.bloqueios, ["decisao_de_promocao_indefinida_adr_002"]);
  assert.equal(r.confidenceEstavel, true);
  assert.match(r.explanation, /ESTRUTURALMENTE ELEGÍVEL/);
});

test("nunca responde 'promovido'/'confiável': estados inexistentes nesta camada", () => {
  const r = avaliar(P_CONSISTENTE, [P_CONSISTENTE], [outcome({ outcomeId: "otc:o", status: "modified" })]);
  const serializado = JSON.stringify(r);
  assert.ok(!serializado.includes('"promovido"'));
  assert.ok(!serializado.includes('"confiavel"') && !serializado.includes('"confiável"'));
});

test("sem Outcomes → bloqueio sem_outcomes_observados (nunca devolvido ao campo)", () => {
  const r = avaliar(P_CONSISTENTE, [P_CONSISTENTE], []);
  assert.equal(r.estruturalmenteElegivel, false);
  assert.ok(r.bloqueios.includes("sem_outcomes_observados"));
  assert.ok(r.bloqueios.includes("decisao_de_promocao_indefinida_adr_002")); // sempre
});

test("confidence abaixo do topo da contagem → bloqueio (topo congelado, não limiar novo)", () => {
  const recorrente = padrao({
    id: "pat-r", valorNovo: "V", ocorrencias: 2, decisoesDeSuporte: ["d1", "d2"],
    confidence: "recorrente", slotEstado: "consistente",
  });
  const r = avaliar(recorrente, [recorrente], [outcome({ outcomeId: "otc:o", status: "pending" })]);
  assert.ok(r.bloqueios.includes("confidence_abaixo_do_topo_da_contagem"));
  assert.equal(r.estruturalmenteElegivel, false);
});

test("slot em disputa → bloqueio slot_em_disputa", () => {
  const disputado = padrao({
    id: "pat-d", valorNovo: "V", ocorrencias: 3, decisoesDeSuporte: ["d1", "d2", "d3"],
    confidence: "recorrente", slotEstado: "em_disputa",
  });
  const r = avaliar(disputado, [disputado], [outcome({ outcomeId: "otc:o", status: "pending" })]);
  assert.ok(r.bloqueios.includes("slot_em_disputa"));
  assert.equal(r.disputas, true);
});

test("confidence rebaixada pelo desconto → confidence_nao_sobrevive_ao_desconto", () => {
  // d3 consumida por oferta confirmada: 3→2 independentes → projetada "recorrente"
  const consumida = outcome({ outcomeId: "otc:ofr-1", status: "confirmed", decisionId: "d3" });
  const r = avaliar(P_CONSISTENTE, [P_CONSISTENTE], [consumida]);
  assert.equal(r.confidenceEstavel, false);
  assert.equal(r.confidenceProjetada, "recorrente");
  assert.ok(r.bloqueios.includes("confidence_nao_sobrevive_ao_desconto"));
  assert.deepEqual(r.decisionsIndependentes, ["d1", "d2"]);
});

test("contagem por status: confirmados são influência, nunca evidência", () => {
  const os = [
    outcome({ outcomeId: "otc:1", status: "confirmed", decisionId: "d-x" }),
    outcome({ outcomeId: "otc:2", status: "modified", decisionId: "d-y" }),
    outcome({ outcomeId: "otc:3", status: "pending" }),
    outcome({ outcomeId: "otc:4", status: "pending", patternId: "pat-OUTRO" }), // não conta
  ];
  const r = avaliar(P_CONSISTENTE, [P_CONSISTENTE], os);
  assert.equal(r.outcomesObservados, 3);
  assert.equal(r.outcomesConfirmados, 1);
  assert.equal(r.outcomesModificados, 1);
  assert.equal(r.outcomesPendentes, 1);
  assert.match(r.evidencias[3], /influência, nunca evidência/);
});

test("explainability completa + dependências da ADR-002 sempre declaradas", () => {
  const r = avaliar(P_CONSISTENTE, [P_CONSISTENTE], []);
  assert.equal(r.evidencias.length, 4); // confidence, desconto, slot, outcomes
  assert.deepEqual(r.dependenciasAdr002, DEPENDENCIAS_ADR_002);
  assert.match(r.explanation, /pertencem à futura ADR-002/);
  assert.match(r.explanation, /não serão preenchidos com código/);
});

test("determinismo e idempotência: mesmos fatos → mesma avaliação", () => {
  const os = [
    outcome({ outcomeId: "otc:1", status: "modified", decisionId: "d-y" }),
    outcome({ outcomeId: "otc:2", status: "pending" }),
  ];
  const a = avaliar(P_CONSISTENTE, [P_CONSISTENTE], os);
  const b = avaliar(P_CONSISTENTE, [P_CONSISTENTE], [...os].reverse());
  assert.deepEqual(a, b);
});

test("avaliarPromocoes: composição pura sobre as projeções sancionadas", async () => {
  const outro = padrao({ id: "pat-c", campo: "precoVenda", contexto: "precificacao", valorNovo: "149.9", decisoesDeSuporte: ["e1"] });
  const repos = {
    leitura: {
      padroes: { listar: async () => [P_CONSISTENTE, outro] },
      decisoes: { listar: async () => [] },
    },
    observacao: {
      ofertas: { listar: async () => [] },
      padroes: { listar: async () => [] },
      decisoes: { listar: async () => [] },
    },
  };
  const avaliacoes = await avaliarPromocoes("cli-01", repos);
  assert.equal(avaliacoes.length, 2);
  assert.ok(avaliacoes.every((r) => !r.estruturalmenteElegivel)); // sem outcomes
  assert.deepEqual(avaliacoes, await avaliarPromocoes("cli-01", repos)); // idempotente
});
