// Testes do núcleo puro do Pattern Detector (Etapa 2 da R-PD-1).
//
// Cobrem os cenários da RFC-AIL-004 §8 (nascimento, recorrência,
// estabelecimento, disputa, replay/dedup, inelegíveis, isolamento por empresa —
// incluindo o cenário COMPOSTO D1…D8 com o conjunto final publicado na RFC),
// canonicalização na agregação e CONFLUÊNCIA (§7.3): permutações do mesmo
// multiconjunto produzem exatamente o mesmo resultado.
// 100% puro: nenhum I/O, nenhum banco, nenhuma escrita.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/domain/pattern-detector.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "./decision.ts";
import { computarPadroes } from "./pattern-detector.ts";

function decisao(id: string, over: Partial<Decision> = {}): Decision {
  return {
    id,
    empresa: "emp-A",
    autor: "",
    contexto: "catalogo",
    entidade: { tipo: "produto", id: "prod-1" },
    campo: "categoria",
    valorAnterior: "MLB1000",
    valorNovo: "MLB273770",
    origem: "tela/produtos/editar",
    timestamp: "2026-07-01T00:00:00.000Z",
    correlacao: null,
    ...over,
  };
}

test("cenário 1 — nascimento: 1 Decision elegível → 1 Pattern Observado/Emergente", async () => {
  const [p, ...resto] = await computarPadroes([decisao("d1")]);
  assert.equal(resto.length, 0);
  assert.equal(p.ocorrencias, 1);
  assert.equal(p.confidence, "observado");
  assert.equal(p.estado, "emergente");
  assert.equal(p.slotEstado, "emergente");
  assert.deepEqual(p.decisoesDeSuporte, ["d1"]);
  assert.equal(p.primeiraOcorrencia, p.ultimaOcorrencia);
  assert.equal(p.valorNovo, "MLB273770");
});

test("cenário 2/3 — recorrência e estabelecimento: 2→Recorrente; 3→Consistente/Estabelecido", async () => {
  const d = (id: string, ts: string) => decisao(id, { timestamp: ts });
  const dois = await computarPadroes([
    d("d1", "2026-07-01T00:00:00.000Z"),
    d("d2", "2026-07-09T00:00:00.000Z"),
  ]);
  assert.equal(dois[0].confidence, "recorrente");
  assert.equal(dois[0].slotEstado, "consistente");

  const tres = await computarPadroes([
    d("d1", "2026-07-01T00:00:00.000Z"),
    d("d2", "2026-07-09T00:00:00.000Z"),
    d("d3", "2026-07-15T00:00:00.000Z"),
  ]);
  assert.equal(tres[0].ocorrencias, 3);
  assert.equal(tres[0].confidence, "consistente");
  assert.equal(tres[0].estado, "estabelecido");
  assert.equal(tres[0].primeiraOcorrencia, "2026-07-01T00:00:00.000Z");
  assert.equal(tres[0].ultimaOcorrencia, "2026-07-15T00:00:00.000Z");
});

test("cenário composto D1…D8 (§8): conjunto final exato da RFC, com disputa e dedup", async () => {
  const entrada: Decision[] = [
    decisao("d1"),
    decisao("d2"),
    decisao("d3"),
    decisao("d4", { valorNovo: "MLB999999" }),
    decisao("d5", { valorNovo: "MLB999999" }),
    decisao("d6", { contexto: "pendencia", campo: "resolvida", valorAnterior: "false", valorNovo: "true" }), // inelegível
    decisao("d7", { contexto: "publicacao", campo: "tipoAnuncio", valorAnterior: "Premium", valorNovo: "Premium" }), // sem delta
    decisao("d3"), // D3' — replay do MESMO DecisionId
    decisao("d8", { empresa: "emp-B" }),
  ];
  const padroes = await computarPadroes(entrada);
  assert.equal(padroes.length, 3, "D6/D7 não produzem Pattern; D3' é no-op");

  const p1 = padroes.find((p) => p.empresa === "emp-A" && p.valorNovo === "MLB273770");
  const p2 = padroes.find((p) => p.empresa === "emp-A" && p.valorNovo === "MLB999999");
  const p3 = padroes.find((p) => p.empresa === "emp-B");
  assert.ok(p1 && p2 && p3);

  // P1: suporte 3 (d3 replay não conta), REBAIXADO pela disputa (slot em_disputa).
  assert.equal(p1.ocorrencias, 3);
  assert.equal(p1.confidence, "recorrente");
  assert.equal(p1.estado, "emergente");
  assert.equal(p1.slotEstado, "em_disputa");
  assert.deepEqual(p1.decisoesDeSuporte, ["d1", "d2", "d3"]);
  // P2: concorrente recorrente no mesmo slot.
  assert.equal(p2.ocorrencias, 2);
  assert.equal(p2.confidence, "recorrente");
  assert.equal(p2.slotEstado, "em_disputa");
  // P3: outra empresa — isolado, slot próprio, intocado pela disputa de emp-A.
  assert.equal(p3.ocorrencias, 1);
  assert.equal(p3.confidence, "observado");
  assert.equal(p3.slotEstado, "emergente");
});

test("dedup por DecisionId: o mesmo id N vezes conta UMA vez (replay idempotente)", async () => {
  const padroes = await computarPadroes([decisao("d1"), decisao("d1"), decisao("d1")]);
  assert.equal(padroes.length, 1);
  assert.equal(padroes[0].ocorrencias, 1);
  assert.deepEqual(padroes[0].decisoesDeSuporte, ["d1"]);
});

test("replay do detector: computar duas vezes a mesma entrada → resultado idêntico", async () => {
  const entrada = [decisao("d1"), decisao("d2", { valorNovo: "MLB999999" }), decisao("d3")];
  const a = await computarPadroes(entrada);
  const b = await computarPadroes(entrada);
  assert.deepEqual(a, b);
});

test("canonicalização na agregação: variantes de caixa/espaço somam no MESMO Pattern", async () => {
  const padroes = await computarPadroes([
    decisao("d1", { campo: "informacaoPendente", valorAnterior: null, valorNovo: "Enviar  Planilha de Custos " }),
    decisao("d2", { campo: "informacaoPendente", valorAnterior: null, valorNovo: "enviar planilha de custos" }),
  ]);
  assert.equal(padroes.length, 1, "valores semanticamente iguais → mesma PatternKey");
  assert.equal(padroes[0].ocorrencias, 2);
  assert.equal(padroes[0].valorNovo, "enviar planilha de custos");
});

test("isolamento por empresa: mesma quádrupla semântica em tenants distintos nunca se mistura", async () => {
  const padroes = await computarPadroes([decisao("d1"), decisao("d2", { empresa: "emp-B" })]);
  assert.equal(padroes.length, 2);
  const suportes = padroes.map((p) => p.ocorrencias);
  assert.deepEqual(suportes, [1, 1]);
  assert.notEqual(padroes[0].id, padroes[1].id);
});

test("CONFLUÊNCIA (§7.3): permutações do mesmo multiconjunto → exatamente os mesmos Patterns", async () => {
  const base: Decision[] = [
    decisao("d1"),
    decisao("d2"),
    decisao("d3"),
    decisao("d4", { valorNovo: "MLB999999" }),
    decisao("d5", { valorNovo: "MLB999999" }),
    decisao("d6", { contexto: "pendencia", valorNovo: "true" }),
    decisao("d3"), // replay embutido
    decisao("d8", { empresa: "emp-B" }),
  ];
  const referencia = await computarPadroes(base);

  const invertida = [...base].reverse();
  const intercalada = [base[4], base[0], base[7], base[2], base[6], base[1], base[5], base[3]];
  assert.deepEqual(await computarPadroes(invertida), referencia);
  assert.deepEqual(await computarPadroes(intercalada), referencia);
});

test("empates de instante desempatam deterministicamente (confluência de min/max)", async () => {
  // Mesmo instante em formatos distintos: a escolha não pode depender da ordem.
  const a = decisao("d1", { timestamp: "2026-07-01T00:00:00Z" });
  const b = decisao("d2", { timestamp: "2026-07-01T00:00:00.000Z" });
  const r1 = await computarPadroes([a, b]);
  const r2 = await computarPadroes([b, a]);
  assert.deepEqual(r1, r2);
});
