// Testes da prévia de importação — as partes puras.
// Rodar: npx tsx --test src/modules/catalog/domain/analiseDeImportacaoDeCustos.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  calcularVariacao,
  distribuicaoDeVariacao,
  estatisticas,
  type VariacaoDeCusto,
} from "./analiseDeImportacaoDeCustos.ts";

// ── calcularVariacao ─────────────────────────────────────────────────────────

test("sem custo anterior, variação percentual é null", () => {
  const v = calcularVariacao("p1", 0, 50);
  assert.equal(v.variacaoPercentual, null);
  assert.equal(v.variacaoAbsoluta, 50);
});

test("custo subiu 20%", () => {
  const v = calcularVariacao("p1", 100, 120);
  assert.equal(v.variacaoPercentual, 0.2);
  assert.equal(v.variacaoAbsoluta, 20);
});

test("custo caiu — percentual negativo, absoluta sempre positiva", () => {
  const v = calcularVariacao("p1", 100, 80);
  assert.equal(v.variacaoPercentual, -0.2);
  assert.equal(v.variacaoAbsoluta, 20);
});

test("custo igual — variação zero, não null", () => {
  const v = calcularVariacao("p1", 50, 50);
  assert.equal(v.variacaoPercentual, 0);
  assert.equal(v.variacaoAbsoluta, 0);
});

// ── estatisticas ─────────────────────────────────────────────────────────────

test("lista vazia devolve null — zero amostra não é zero valor", () => {
  assert.equal(estatisticas([]), null);
});

test("uma amostra só: todos os percentis são ela mesma", () => {
  const e = estatisticas([42]);
  assert.ok(e);
  assert.equal(e.amostras, 1);
  assert.equal(e.min, 42);
  assert.equal(e.max, 42);
  assert.equal(e.media, 42);
  assert.equal(e.mediana, 42);
  assert.equal(e.p99, 42);
});

test("min/max/média/mediana batem com a conta manual", () => {
  const e = estatisticas([10, 20, 30, 40, 50]);
  assert.ok(e);
  assert.equal(e.amostras, 5);
  assert.equal(e.min, 10);
  assert.equal(e.max, 50);
  assert.equal(e.media, 30);
  assert.equal(e.mediana, 30);
});

test("percentil não depende da ordem de entrada", () => {
  const a = estatisticas([5, 1, 4, 2, 3]);
  const b = estatisticas([1, 2, 3, 4, 5]);
  assert.deepEqual(a, b);
});

test("p99 de uma amostra grande fica perto do topo, não no máximo", () => {
  // 100 valores de 1 a 100: o p99 é a posição 99, não a posição 100 (o máximo).
  const valores = Array.from({ length: 100 }, (_, i) => i + 1);
  const e = estatisticas(valores);
  assert.ok(e);
  assert.equal(e.max, 100);
  assert.equal(e.p99, 99);
});

// ── distribuicaoDeVariacao ───────────────────────────────────────────────────

function v(produtoId: string, custoAtual: number, custoNovo: number): VariacaoDeCusto {
  return calcularVariacao(produtoId, custoAtual, custoNovo);
}

test("as quatro categorias somam o total", () => {
  const d = distribuicaoDeVariacao([
    v("p1", 0, 30), // sem custo anterior
    v("p2", 50, 50), // sem mudança
    v("p3", 50, 55), // com mudança
    v("p4", 100, 200), // com mudança
  ]);
  assert.equal(d.total, 4);
  assert.equal(d.semCustoAnterior, 1);
  assert.equal(d.semMudanca, 1);
  assert.equal(d.comMudanca, 2);
});

test("as estatísticas só olham para quem teve mudança de verdade", () => {
  const d = distribuicaoDeVariacao([
    v("p1", 0, 999), // fora — sem custo anterior
    v("p2", 50, 50), // fora — sem mudança
    v("p3", 100, 120), // dentro — 20%, R$20
    v("p4", 100, 80), // dentro — -20% (abs 20%), R$20
  ]);
  assert.ok(d.percentual);
  assert.ok(d.absoluta);
  assert.equal(d.percentual.amostras, 2);
  assert.equal(d.percentual.media, 0.2); // |20%| e |-20%| → média 20%
  assert.equal(d.absoluta.media, 20);
});

test("lista vazia dá zero em tudo, e null nas estatísticas", () => {
  const d = distribuicaoDeVariacao([]);
  assert.equal(d.total, 0);
  assert.equal(d.percentual, null);
  assert.equal(d.absoluta, null);
});

test("só sem-custo-anterior: nenhuma amostra de variação, mesmo com itens", () => {
  const d = distribuicaoDeVariacao([v("p1", 0, 10), v("p2", 0, 20)]);
  assert.equal(d.total, 2);
  assert.equal(d.semCustoAnterior, 2);
  assert.equal(d.comMudanca, 0);
  assert.equal(d.percentual, null);
  assert.equal(d.absoluta, null);
});
