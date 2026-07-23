// Testes da Knowledge Maturation (E5.10a) — conformidade com a ADR-002.
//
// Cada teste cita a questão da ADR que verifica: Q2 (as 3 condições, régua
// recomeça por versão), Q3 (híbrida — sem assinatura não há promoção; motivo
// obrigatório), Q5 (rebaixamento por fato; sistema só sinaliza), Q7 (versões
// imutáveis; vigente = última não-rebaixada), Q9 (fotografia congelada).
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/knowledge-maturation.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Padrao } from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import {
  estadoConhecimento,
  sobContradicao,
  verificarPromovibilidade,
  VERSAO_POLITICA_MATURACAO,
  type FatoMaturacao,
} from "../domain/knowledge.ts";
import { evoluirConfidence } from "./confidence-evolution.ts";
import { avaliarPromocao } from "./promotion-readiness.ts";
import {
  carregarConhecimento,
  promoverConhecimento,
  rebaixarConhecimento,
  type DepsMaturacao,
} from "./knowledge-maturation.ts";
import type { PadraoNoCentro } from "./intelligence-center.ts";
import { visaoDe } from "./pattern-browser.ts";

const PADRAO: Padrao = {
  id: "pat-a",
  chave: JSON.stringify(["cli-01", "catalogo", "categoriaMarketplace", "MLB273770"]),
  empresa: "cli-01", contexto: "catalogo", campo: "categoriaMarketplace",
  valorNovo: "MLB273770", ocorrencias: 3, decisoesDeSuporte: ["d1", "d2", "d3"],
  primeiraOcorrencia: "2026-07-01T10:00:00.000Z", ultimaOcorrencia: "2026-07-20T10:00:00.000Z",
  confidence: "consistente", estado: "estabelecido", slotEstado: "consistente",
};

function outcome(id: string, status: Outcome["status"], respondedAt: string | null): Outcome {
  return {
    outcomeId: id, offerId: id.replace("otc:", ""), empresaId: "cli-01",
    slot: { contexto: "catalogo", campo: "categoriaMarketplace" }, entidade: null,
    status, decisionId: respondedAt ? "d-r" : null, author: respondedAt ? "ana@zion.com" : null,
    respondedAt, responseTimeMs: respondedAt ? 1000 : null,
    evidence: {
      valorOferecido: "MLB273770", valorDecidido: respondedAt ? "MLB273770" : null,
      diferenca: respondedAt ? (status === "confirmed" ? "nenhuma" : "valor_alterado") : null,
      patternId: "pat-a", confidenceNaOferta: "consistente", respostasSubsequentes: 0,
    },
    explanation: "teste",
  };
}

// Campo maduro: 2 respondidos, o último é confirmed (Q2 satisfeita).
const OUTCOMES_MADUROS = [
  outcome("otc:1", "modified", "2026-07-21T10:00:00.000Z"),
  outcome("otc:2", "confirmed", "2026-07-22T10:00:00.000Z"),
];

function linha(outcomes: Outcome[]): PadraoNoCentro {
  const evolution = evoluirConfidence(PADRAO, [PADRAO], outcomes);
  return {
    padrao: visaoDe(PADRAO),
    evolution,
    readiness: avaliarPromocao(PADRAO, evolution, outcomes),
    outcomes,
  };
}

function deps(outcomes: Outcome[], opts?: { autor?: string; fatos?: FatoMaturacao[] }): DepsMaturacao & { gravados: FatoMaturacao[] } {
  const gravados: FatoMaturacao[] = [...(opts?.fatos ?? [])];
  return {
    gravados,
    fatos: {
      listar: async () => [...gravados],
      salvar: async (f) => (gravados.push(f), f), // append-only
    },
    carregarPadrao: async (id) => (id === "pat-a" ? linha(outcomes) : null),
    autor: async () => opts?.autor ?? "mantenedor@zion.com",
  };
}

test("Q2: as TRÊS condições — elegível ∧ respondidos ≥2 ∧ última resposta confirmed", () => {
  const l = linha(OUTCOMES_MADUROS);
  const v = verificarPromovibilidade(l.readiness, OUTCOMES_MADUROS, []);
  assert.equal(v.promovivel, true);
  assert.equal(v.condicoes.length, 3); // nenhuma condição a mais (ADR: "nenhuma política nova")
});

test("Q2: última resposta modified → NÃO promovível (confirmação não sustentada)", () => {
  const invertidos = [
    outcome("otc:1", "confirmed", "2026-07-21T10:00:00.000Z"),
    outcome("otc:2", "modified", "2026-07-22T10:00:00.000Z"),
  ];
  const l = linha(invertidos);
  const v = verificarPromovibilidade(l.readiness, invertidos, []);
  assert.equal(v.promovivel, false);
  assert.match(v.condicoes[2].evidencia, /modified/);
});

test("Q2 (régua recomeça): outcomes anteriores à última promoção NÃO contam para v2", async () => {
  const d = deps(OUTCOMES_MADUROS);
  const v1 = await promoverConhecimento("pat-a", "primeiro ciclo de campo completo", d);
  assert.ok(v1.ok);
  // Mesmos outcomes (todos ANTERIORES à promoção v1) → v2 não é promovível:
  const visao = await carregarConhecimento("pat-a", d);
  assert.equal(visao?.promovibilidade.promovivel, false);
  assert.match(visao!.promovibilidade.condicoes[1].condicao, /após a última promoção/);
});

test("Q3: sem assinatura humana NÃO há promoção (híbrida, nunca automática)", async () => {
  const d = deps(OUTCOMES_MADUROS, { autor: "" });
  const r = await promoverConhecimento("pat-a", "motivo válido", d);
  assert.equal(r.ok, false);
  assert.match((r as { motivos: string[] }).motivos[0], /assinatura humana/);
  assert.equal(d.gravados.length, 0); // nenhum fato sem assinatura
});

test("Q3: motivo é obrigatório (mitigação 'carimbo sem leitura')", async () => {
  const d = deps(OUTCOMES_MADUROS);
  const r = await promoverConhecimento("pat-a", "   ", d);
  assert.equal(r.ok, false);
  assert.equal(d.gravados.length, 0);
});

test("Q7/Q9: o fato de promoção carrega versão, política e a FOTOGRAFIA congelada", async () => {
  const d = deps(OUTCOMES_MADUROS);
  const r = await promoverConhecimento("pat-a", "campo maduro, evidência completa", d);
  assert.ok(r.ok);
  const f = (r as { fato: FatoMaturacao }).fato;
  assert.equal(f.tipo, "promocao");
  assert.equal(f.versao, 1);
  assert.equal(f.valor, "MLB273770");
  assert.equal(f.autorHumano, "mantenedor@zion.com");
  assert.equal(f.versaoPolitica, VERSAO_POLITICA_MATURACAO);
  assert.equal(f.fotografia.confidenceNoInstante, "consistente");
  assert.equal(f.fotografia.suporteIndependente, 3);
  assert.deepEqual(f.fotografia.outcomesConsiderados, ["otc:1", "otc:2"]);
});

test("Q7: vigente = última promoção não-rebaixada; histórico completo preservado", async () => {
  const d = deps(OUTCOMES_MADUROS);
  await promoverConhecimento("pat-a", "v1", d);
  let visao = await carregarConhecimento("pat-a", d);
  assert.equal(visao?.estado.situacao, "vigente");
  assert.equal(visao?.estado.versaoVigente, 1);

  const reb = await rebaixarConhecimento("pat-a", "cliente pediu esquecimento", d);
  assert.ok(reb.ok);
  visao = await carregarConhecimento("pat-a", d);
  assert.equal(visao?.estado.situacao, "rebaixado");
  assert.equal(visao?.estado.versaoVigente, null);
  assert.equal(visao?.estado.historico.length, 2); // nada apagado — cadeia completa
});

test("Q5: rebaixar sem vigente falha; o sistema SINALIZA contradição, nunca rebaixa", async () => {
  const d = deps(OUTCOMES_MADUROS);
  const r = await rebaixarConhecimento("pat-a", "motivo", d);
  assert.equal(r.ok, false);

  // sinal de contradição: vigente + Pattern que deixou de ser elegível
  const fatoV1: FatoMaturacao = {
    id: "f1", patternId: "pat-a", empresa: "cli-01", contexto: "catalogo",
    campo: "categoriaMarketplace", valor: "MLB273770", tipo: "promocao", versao: 1,
    autorHumano: "m@zion.com", motivo: "v1",
    fotografia: { confidenceNoInstante: "consistente", suporteIndependente: 3, decisoesIndependentes: [], outcomesConsiderados: [], ultimoOutcomeStatus: "confirmed", readinessBloqueios: [] },
    versaoPolitica: VERSAO_POLITICA_MATURACAO, ocorridoEm: "2026-07-23T10:00:00.000Z",
  };
  const estado = estadoConhecimento([fatoV1]);
  const semOutcomes = linha([]); // sem outcomes → readiness não-elegível
  assert.equal(sobContradicao(estado, semOutcomes.readiness), true);
  assert.equal(sobContradicao(estado, null), true); // Pattern de origem ausente → sinaliza
});

test("Pattern ausente com Knowledge vigente: a fotografia sobrevive (ADR §Riscos)", async () => {
  const fatoV1: FatoMaturacao = {
    id: "f1", patternId: "pat-orfao", empresa: "cli-01", contexto: "catalogo",
    campo: "categoriaMarketplace", valor: "X", tipo: "promocao", versao: 1,
    autorHumano: "m@zion.com", motivo: "v1",
    fotografia: { confidenceNoInstante: "consistente", suporteIndependente: 3, decisoesIndependentes: [], outcomesConsiderados: [], ultimoOutcomeStatus: "confirmed", readinessBloqueios: [] },
    versaoPolitica: VERSAO_POLITICA_MATURACAO, ocorridoEm: "2026-07-23T10:00:00.000Z",
  };
  const d = deps([], { fatos: [fatoV1] });
  const visao = await carregarConhecimento("pat-orfao", d);
  assert.equal(visao?.estado.situacao, "vigente"); // o Knowledge não morre com a reprojeção
  assert.equal(visao?.sobContradicao, true); // mas o sinal acende
});
