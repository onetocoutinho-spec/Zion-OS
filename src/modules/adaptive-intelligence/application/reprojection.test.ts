// Testes do Reprojection Runtime (E5.7).
//
// Cobrem: reprojeção completa e PARCIAL por empresa, comparação antes×depois
// (novos/alterados/inalterados/órfãos — órfãos listados, jamais apagados),
// verificação de idempotência na execução, idempotência real (2ª reprojeção →
// zero mudanças) e auditoria completa no relatório. Repositórios em memória.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/reprojection.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "../domain/decision.ts";
import type { Padrao } from "../domain/pattern.ts";
import { compararProjecoes, reprojetar, type ReposReprojecao } from "./reprojection.ts";

function decisao(d: Partial<Decision> & { id: string }): Decision {
  return {
    empresa: "cli-01",
    autor: "ana@zion.com",
    contexto: "catalogo",
    entidade: { tipo: "produto", id: "prd-01" },
    campo: "categoriaMarketplace",
    valorAnterior: "MLB111111",
    valorNovo: "MLB273770",
    origem: "produtos.atualizarProduto",
    timestamp: "2026-07-10T10:00:00.000Z",
    correlacao: null,
    ...d,
  };
}

/** Ambiente em memória: journal + tabela de padrões simulada (upsert por id). */
function ambiente(decisoes: Decision[], padroesIniciais: Padrao[] = []) {
  const tabela = new Map<string, Padrao>(padroesIniciais.map((p) => [p.id, p]));
  const repos: ReposReprojecao = {
    leitura: {
      padroes: { listar: async () => [...tabela.values()] },
      decisoes: { listar: async () => decisoes },
    },
    decisoes: {
      listar: async (filtro) =>
        filtro ? decisoes.filter((d) => d.empresa === filtro.valor) : decisoes,
    },
    padroes: {
      salvar: async (p: Padrao) => {
        tabela.set(p.id, p); // upsert por PatternId (R-INF-001)
        return p;
      },
    },
  };
  return { repos, tabela };
}

test("primeira reprojeção: tudo novo, idempotência verificada na execução", async () => {
  const { repos, tabela } = ambiente([
    decisao({ id: "d1" }),
    decisao({ id: "d2", timestamp: "2026-07-11T10:00:00.000Z" }),
  ]);
  const r = await reprojetar({}, repos);
  assert.equal(r.escopo.decisoesLidas, 2);
  assert.equal(r.antes, 0);
  assert.equal(r.depois, 1); // mesma chave → 1 Pattern, suporte 2
  assert.equal(r.novos, 1);
  assert.equal(r.idempotencia, "verificada_identica");
  assert.equal(tabela.size, 1); // materializado
});

test("idempotência real: a 2ª reprojeção não muda NADA", async () => {
  const { repos } = ambiente([decisao({ id: "d1" }), decisao({ id: "d2" })]);
  await reprojetar({}, repos);
  const r2 = await reprojetar({}, repos);
  assert.equal(r2.novos, 0);
  assert.equal(r2.alterados, 0);
  assert.equal(r2.inalterados, 1);
  assert.equal(r2.orfaos.length, 0);
});

test("nova decisão → Pattern ALTERADO no relatório (suporte cresce)", async () => {
  const base = [decisao({ id: "d1" }), decisao({ id: "d2" })];
  const { repos } = ambiente(base);
  await reprojetar({}, repos);
  base.push(decisao({ id: "d3", timestamp: "2026-07-12T10:00:00.000Z" }));
  const r = await reprojetar({}, repos);
  assert.equal(r.alterados, 1);
  assert.equal(r.diffs[0].antes?.ocorrencias, 2);
  assert.equal(r.diffs[0].depois.ocorrencias, 3);
  assert.equal(r.diffs[0].depois.confidence, "consistente"); // 3 + slot limpo
});

test("reprojeção PARCIAL por empresa: só o tenant é lido e comparado", async () => {
  const { repos } = ambiente([
    decisao({ id: "d1", empresa: "cli-01" }),
    decisao({ id: "d2", empresa: "cli-99", entidade: { tipo: "produto", id: "x" } }),
  ]);
  const r = await reprojetar({ empresa: "cli-01" }, repos);
  assert.equal(r.escopo.empresa, "cli-01");
  assert.equal(r.escopo.decisoesLidas, 1); // filtro aplicado
  assert.equal(r.depois, 1); // só o Pattern de cli-01
  assert.match(r.explanation, /parcial \(empresa cli-01\)/);
});

test("órfãos: linha existente que a computação não produz é LISTADA, não apagada", async () => {
  const orfao: Padrao = {
    id: "pat-orfao-canonicalizacao-antiga",
    chave: "x",
    empresa: "cli-01",
    contexto: "catalogo",
    campo: "categoriaMarketplace",
    valorNovo: "VALOR-ANTIGO",
    ocorrencias: 1,
    decisoesDeSuporte: ["d-velha"],
    primeiraOcorrencia: "2026-01-01T00:00:00.000Z",
    ultimaOcorrencia: "2026-01-01T00:00:00.000Z",
    confidence: "observado",
    estado: "emergente",
    slotEstado: "emergente",
  };
  const { repos, tabela } = ambiente([decisao({ id: "d1" })], [orfao]);
  const r = await reprojetar({}, repos);
  assert.deepEqual(r.orfaos, ["pat-orfao-canonicalizacao-antiga"]);
  assert.ok(tabela.has("pat-orfao-canonicalizacao-antiga")); // JAMAIS apagado
  assert.match(r.explanation, /decisão de governança/);
});

test("compararProjecoes (pura): classifica novo/alterado/inalterado e órfãos", () => {
  const p = (id: string, ocorrencias: number): Padrao => ({
    id, chave: "x", empresa: "e", contexto: "catalogo", campo: "c", valorNovo: "v",
    ocorrencias, decisoesDeSuporte: [], primeiraOcorrencia: "2026-01-01T00:00:00.000Z",
    ultimaOcorrencia: "2026-01-01T00:00:00.000Z", confidence: "observado",
    estado: "emergente", slotEstado: "emergente",
  });
  const { diffs, orfaos } = compararProjecoes(
    [p("a", 1), p("b", 1), p("sumiu", 1)],
    [p("a", 2), p("b", 1), p("novo", 1)]
  );
  const porId = new Map(diffs.map((d) => [d.patternId, d.situacao]));
  assert.equal(porId.get("a"), "alterado");
  assert.equal(porId.get("b"), "inalterado");
  assert.equal(porId.get("novo"), "novo");
  assert.deepEqual(orfaos, ["sumiu"]);
});

test("auditoria: o relatório é serializável e cita a regra de idempotência", async () => {
  const { repos } = ambiente([decisao({ id: "d1" })]);
  const r = await reprojetar({}, repos);
  assert.deepEqual(JSON.parse(JSON.stringify(r)), r);
  assert.match(r.explanation, /confluência, RFC-AIL-004 §7\.3/);
  assert.match(r.explanation, /upsert-por-PatternId/);
});
