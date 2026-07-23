// Testes da Confidence Evolution (E5.3).
//
// Cobrem: nenhum Outcome, apenas confirmados (desconto de auto-reforço com
// rebaixamento pelas funções CONGELADAS), modificados como contradição
// observada (nunca descontados), múltiplos Patterns (slot reavaliado com a
// mesma regra), determinismo, idempotência e explicabilidade completa —
// incluindo a nota fixa de elevação bloqueada. Zero escrita, zero mutação.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/confidence-evolution.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Padrao } from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import {
  evoluirConfidence,
  evoluirConfidences,
  NOTA_ELEVACAO_BLOQUEADA,
} from "./confidence-evolution.ts";

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

function outcome(o: Partial<Outcome> & { outcomeId: string; status: Outcome["status"] }): Outcome {
  return {
    offerId: o.outcomeId.replace("otc:", ""),
    empresaId: "cli-01",
    slot: { contexto: "catalogo", campo: "categoriaMarketplace" },
    entidade: null,
    decisionId: null,
    author: null,
    respondedAt: null,
    responseTimeMs: null,
    evidence: {
      valorOferecido: "MLB273770",
      valorDecidido: null,
      diferenca: null,
      patternId: "pat-a",
      confidenceNaOferta: "consistente",
      ocorrenciasNoMomento: 3,
      respostasSubsequentes: 0,
    } as Outcome["evidence"],
    explanation: "teste",
    ...o,
  } as Outcome;
}

// Pattern consistente com 3 suportes — d3 foi uma aceitação de oferta.
const P_CONSISTENTE = padrao({
  id: "pat-a",
  valorNovo: "MLB273770",
  ocorrencias: 3,
  decisoesDeSuporte: ["d1", "d2", "d3"],
  confidence: "consistente",
  estado: "estabelecido",
  slotEstado: "consistente",
});

const CONFIRMADO_D3 = outcome({
  outcomeId: "otc:ofr-1",
  status: "confirmed",
  decisionId: "d3",
});

const MODIFICADO = outcome({ outcomeId: "otc:ofr-2", status: "modified", decisionId: "d9" });

test("nenhum Outcome → mantida, com suporte integral e nota de elevação", () => {
  const ev = evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], []);
  assert.equal(ev.motivo, "mantida_sem_outcomes");
  assert.equal(ev.confidenceAnterior, "consistente");
  assert.equal(ev.confidenceProjetada, "consistente");
  assert.equal(ev.suporte.independente, 3);
  assert.match(ev.explanation, /Elevação acima de 'consistente'/); // sempre presente
});

test("desconto de auto-reforço: sem a confirmação, o nível CAI pelas regras congeladas", () => {
  const ev = evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], [CONFIRMADO_D3]);
  // 3 suportes − 1 consumida = 2 → recorrente (LIMIAR_CONSISTENTE=3 não atingido)
  assert.equal(ev.confidenceProjetada, "recorrente");
  assert.equal(ev.motivo, "rebaixada_por_desconto_de_auto_reforco");
  assert.deepEqual(ev.evidenciasUtilizadas.decisoesIndependentes, ["d1", "d2"]);
  assert.equal(ev.evidenciasDescontadas.length, 1);
  assert.deepEqual(ev.evidenciasDescontadas[0], {
    decisionId: "d3",
    offerId: "ofr-1",
    outcomeId: "otc:ofr-1",
    porque: "consumida_pela_oferta",
  });
  assert.match(ev.explanation, /o operador concordou com a sugestão/);
});

test("apenas confirmados que NÃO tocam o suporte → mantida por evidência independente", () => {
  const confirmadoAlheio = outcome({
    outcomeId: "otc:ofr-9",
    status: "confirmed",
    decisionId: "d-fora-do-suporte",
  });
  const ev = evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], [confirmadoAlheio]);
  assert.equal(ev.confidenceProjetada, "consistente");
  // houve outcome no universo, mas nada foi descontado nem contradito:
  assert.equal(ev.evidenciasDescontadas.length, 0);
});

test("modified = contradição OBSERVADA: listada, jamais descontada", () => {
  const ev = evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], [MODIFICADO]);
  assert.deepEqual(ev.evidenciasUtilizadas.outcomesModificados, ["otc:ofr-2"]);
  assert.equal(ev.suporte.independente, 3); // nada removido do suporte
  assert.match(ev.explanation, /contrariou a sugestão/);
});

test("desconto de outro Pattern não vaza: confirmed aponta patternId próprio", () => {
  const confirmadoDeOutro = outcome({
    outcomeId: "otc:ofr-3",
    status: "confirmed",
    decisionId: "d3",
    evidence: {
      valorOferecido: "X",
      valorDecidido: "X",
      diferenca: "nenhuma",
      patternId: "pat-OUTRO", // oferta veio de OUTRO pattern
      confidenceNaOferta: "consistente",
      respostasSubsequentes: 0,
    } as Outcome["evidence"],
  });
  const ev = evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], [confirmadoDeOutro]);
  assert.equal(ev.suporte.independente, 3); // d3 NÃO é descontada
});

test("slot reavaliado com a MESMA regra: concorrente descontado libera a graduação", () => {
  // Concorrente com 2 suportes, ambos consumidos por ofertas confirmadas dele.
  const concorrente = padrao({
    id: "pat-b",
    valorNovo: "MLB999999",
    ocorrencias: 2,
    decisoesDeSuporte: ["c1", "c2"],
    confidence: "recorrente",
    slotEstado: "em_disputa",
  });
  const alvo = padrao({
    id: "pat-a",
    valorNovo: "MLB273770",
    ocorrencias: 3,
    decisoesDeSuporte: ["d1", "d2", "d3"],
    confidence: "recorrente", // rebaixado pela disputa materializada
    slotEstado: "em_disputa",
  });
  const consumoC1 = outcome({
    outcomeId: "otc:ofr-c1", status: "confirmed", decisionId: "c1",
    evidence: { valorOferecido: "MLB999999", valorDecidido: "MLB999999", diferenca: "nenhuma", patternId: "pat-b", confidenceNaOferta: "consistente", respostasSubsequentes: 0 } as Outcome["evidence"],
  });
  const ev = evoluirConfidence(alvo, [alvo, concorrente], [consumoC1]);
  // concorrente independente = 1 (< LIMIAR_RECORRENTE) → slot volta a CONSISTENTE
  // alvo independente = 3 → consistente (a disputa era sustentada por auto-reforço)
  assert.equal(ev.confidenceProjetada, "consistente");
});

test("determinismo e idempotência: mesmos fatos → mesmo resultado, em qualquer ordem", () => {
  const a = evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], [CONFIRMADO_D3, MODIFICADO]);
  const b = evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], [MODIFICADO, CONFIRMADO_D3]);
  assert.deepEqual(a, b);
  assert.deepEqual(a, evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], [CONFIRMADO_D3, MODIFICADO]));
});

test("múltiplos Patterns: evoluirConfidences reavalia cada um contra o mesmo universo", async () => {
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
  const evolucoes = await evoluirConfidences("cli-01", repos);
  assert.equal(evolucoes.length, 2);
  assert.ok(evolucoes.every((e) => e.motivo === "mantida_sem_outcomes"));
  // idempotência da variante de carregamento:
  assert.deepEqual(evolucoes, await evoluirConfidences("cli-01", repos));
});

test("explicabilidade completa: anterior, regra, resultado, descartes e porquês", () => {
  const ev = evoluirConfidence(P_CONSISTENTE, [P_CONSISTENTE], [CONFIRMADO_D3]);
  assert.match(ev.explanation, /Confidence materializada: "consistente"/); // qual existia
  assert.match(ev.explanation, /Descontadas 1/); // quais descartados e por quê
  assert.match(ev.explanation, /confidenceDe\(suporte independente/); // qual regra
  assert.match(ev.explanation, /Resultado: "recorrente"/); // qual resultou
  assert.equal(ev.explanation.includes(NOTA_ELEVACAO_BLOQUEADA), true);
});
