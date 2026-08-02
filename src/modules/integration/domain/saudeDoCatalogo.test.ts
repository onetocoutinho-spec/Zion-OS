// O retrato do catálogo pelos campos que o ML sempre mandou.
//
// O inventário de 02/08/2026 mostrou 61 campos disponíveis contra 14 pedidos.
// Sete grupos dos 47 ignorados respondiam perguntas ABERTAS naquele momento —
// entre elas "qual anúncio conserto primeiro?", que a gente vinha tentando
// responder deduzindo tamanho de foto enquanto o ML entregava a nota pronta.
//
// A regra que atravessa todas as contas: AUSÊNCIA NUNCA VIRA ZERO.

import test from "node:test";
import assert from "node:assert/strict";
import { retratarCatalogo, SAUDE_BAIXA } from "./saudeDoCatalogo.ts";

const a = (mlb: string, p: Record<string, unknown> = {}) => ({
  mlb,
  status: "active",
  ...p,
});

// ---------------------------------------------------------------------------
// SAÚDE — o número que decide exposição
// ---------------------------------------------------------------------------

test("a média sai só dos anúncios que o ML avaliou", () => {
  const r = retratarCatalogo([
    a("A", { saude: 1 }),
    a("B", { saude: 0.5 }),
    a("C"), // sem saúde
  ]);
  assert.equal(r.comSaude, 2);
  assert.equal(r.saudeMedia, 0.75, "o terceiro entrou na conta como zero");
});

test("saúde ausente NÃO é saúde zero", () => {
  // Um anúncio sem nota não é um anúncio ruim — é um anúncio que o ML não
  // avaliou. Confundir os dois manda a lojista consertar o que talvez esteja bom.
  const r = retratarCatalogo([a("A", { saude: null }), a("B", { saude: undefined })]);
  assert.equal(r.comSaude, 0);
  assert.equal(r.saudeMedia, 0);
  assert.deepEqual(r.piores, []);
});

test("os piores vêm primeiro e só abaixo do limite", () => {
  const r = retratarCatalogo([
    a("BOM", { saude: 0.95 }),
    a("PESSIMO", { saude: 0.2 }),
    a("RUIM", { saude: 0.6 }),
  ]);
  assert.deepEqual(
    r.piores.map((x) => x.mlb),
    ["PESSIMO", "RUIM"]
  );
  assert.ok(SAUDE_BAIXA > 0.6 && SAUDE_BAIXA <= 0.95);
});

test("a nota acompanha o MLB — o número sozinho não diz onde mexer", () => {
  const r = retratarCatalogo([a("MLB1", { saude: 0.3 })]);
  assert.deepEqual(r.piores, [{ mlb: "MLB1", saude: 0.3 }]);
});

// ---------------------------------------------------------------------------
// VENDAS — o catálogo não tinha nenhum dado disso
// ---------------------------------------------------------------------------

test("`vendidos: 0` conta como não vendeu; ausente NÃO conta", () => {
  // Zero é uma AFIRMAÇÃO do ML. Ausência é silêncio.
  const r = retratarCatalogo([
    a("VENDEU", { vendidos: 5 }),
    a("NAO_VENDEU", { vendidos: 0 }),
    a("NAO_SEI", { vendidos: null }),
  ]);
  assert.equal(r.noArSemVenda, 1);
  assert.equal(r.vendidosTotal, 5);
});

test("anúncio FORA do ar sem venda não entra — não é o problema de hoje", () => {
  const r = retratarCatalogo([
    { mlb: "PAUSADO", status: "paused", vendidos: 0 },
    { mlb: "ATIVO", status: "active", vendidos: 0 },
  ]);
  assert.equal(r.noArSemVenda, 1);
});

// ---------------------------------------------------------------------------
// CATÁLOGO, DESCRIÇÃO, TIPO, DATA
// ---------------------------------------------------------------------------

test("só `true` conta como do catálogo — `null` é não sei", () => {
  const r = retratarCatalogo([
    a("A", { doCatalogo: true }),
    a("B", { doCatalogo: false }),
    a("C", { doCatalogo: null }),
  ]);
  assert.equal(r.doCatalogo, 1);
});

test("só `false` conta como sem descrição — ausente é não sei", () => {
  const r = retratarCatalogo([
    a("A", { temDescricao: true }),
    a("B", { temDescricao: false }),
    a("C"),
  ]);
  assert.equal(r.semDescricao, 1);
});

test("o tipo de anúncio é contado — ele muda a comissão", () => {
  const r = retratarCatalogo([
    a("A", { tipoDeAnuncio: "gold_special" }),
    a("B", { tipoDeAnuncio: "gold_special" }),
    a("C", { tipoDeAnuncio: "gold_pro" }),
    a("D", { tipoDeAnuncio: "" }),
  ]);
  assert.deepEqual(r.porTipo, [
    { tipo: "gold_special", anuncios: 2 },
    { tipo: "gold_pro", anuncios: 1 },
  ]);
});

test("a data de alteração agrupa por DIA — é o teste da edição em massa", () => {
  // Se os 155 em revisão foram todos mexidos no mesmo dia, a hipótese deixa
  // de ser hipótese.
  const r = retratarCatalogo([
    a("A", { atualizadoEmML: "2026-07-14T10:00:00.000Z" }),
    a("B", { atualizadoEmML: "2026-07-14T23:59:00.000Z" }),
    a("C", { atualizadoEmML: "2026-08-01T08:00:00.000Z" }),
  ]);
  assert.deepEqual(r.alteradosPorDia, [
    { dia: "2026-07-14", anuncios: 2 },
    { dia: "2026-08-01", anuncios: 1 },
  ]);
});

test("catálogo vazio não afirma nada", () => {
  const r = retratarCatalogo([]);
  assert.equal(r.comSaude, 0);
  assert.equal(r.saudeMedia, 0);
  assert.deepEqual(r.porTipo, []);
  assert.deepEqual(r.alteradosPorDia, []);
});
