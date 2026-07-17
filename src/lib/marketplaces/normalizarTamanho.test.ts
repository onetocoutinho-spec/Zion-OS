// Testes do normalizador de tamanho. Puros, sem rede/React.
// Rodar: node --test src/lib/marketplaces/normalizarTamanho.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarTamanho } from "./normalizarTamanho.ts";

// ---- Números limpos e com ruído de localidade ----

test("tamanho já limpo passa inalterado", () => {
  assert.deepEqual(normalizarTamanho("38"), { ok: true, valor: "38", original: "38" });
});

test('remove o sufixo " BR"', () => {
  assert.equal(normalizarTamanho("38 BR").valor, "38");
  assert.equal(normalizarTamanho("40 BRASIL").valor, "40");
});

test("remove espaços em volta", () => {
  assert.equal(normalizarTamanho("  39  ").valor, "39");
});

test('remove rótulos "Tam" / "Nº"', () => {
  assert.equal(normalizarTamanho("Tam 40").valor, "40");
  assert.equal(normalizarTamanho("Nº 39").valor, "39");
  assert.equal(normalizarTamanho("N 39").valor, "39");
  assert.equal(normalizarTamanho("Tamanho 41").valor, "41");
});

// ---- Decimais ----

test("vírgula vira ponto em meio-número", () => {
  assert.equal(normalizarTamanho("37,5").valor, "37.5");
});

test('decimal inteiro colapsa ("38.0" → "38")', () => {
  assert.equal(normalizarTamanho("38.0").valor, "38");
});

// ---- Pares de chinelo (inteiros adjacentes) ----

test('par com barra "33/34" é canônico', () => {
  assert.equal(normalizarTamanho("33/34").valor, "33/34");
});

test('par com hífen e espaços "33 - 34" → "33/34"', () => {
  assert.equal(normalizarTamanho("33 - 34").valor, "33/34");
});

test('par escrito "35 A 36" / "35 ao 36" → "35/36"', () => {
  assert.equal(normalizarTamanho("35 A 36").valor, "35/36");
  assert.equal(normalizarTamanho("35 ao 36").valor, "35/36");
});

test("ordem invertida ainda produz min/max", () => {
  assert.equal(normalizarTamanho("34/33").valor, "33/34");
});

test("dois números iguais colapsam num só", () => {
  assert.equal(normalizarTamanho("34 34").valor, "34");
});

// ---- Faixas e ambiguidades: NÃO inventa (L05) ----

test('faixa larga "33-38" não é um tamanho único', () => {
  const r = normalizarTamanho("33-38");
  assert.equal(r.ok, false);
  assert.match(r.motivo ?? "", /faixa/i);
});

test('faixa escrita "34 ao 39" é rejeitada', () => {
  assert.equal(normalizarTamanho("34 ao 39").ok, false);
});

test("três números ou mais é ambíguo", () => {
  assert.equal(normalizarTamanho("33 34 35").ok, false);
});

test("não numérico (letra) é sinalizado, nunca chutado", () => {
  const r = normalizarTamanho("M");
  assert.equal(r.ok, false);
  assert.equal(r.valor, "");
});

test("vazio e só-espaços são rejeitados", () => {
  assert.equal(normalizarTamanho("").ok, false);
  assert.equal(normalizarTamanho("   ").ok, false);
  assert.equal(normalizarTamanho(null).ok, false);
  assert.equal(normalizarTamanho(undefined).ok, false);
});

// ---- Preserva o original e é idempotente (o requisito do join) ----

test("preserva a entrada original", () => {
  assert.equal(normalizarTamanho("38 BR").original, "38 BR");
});

test("idempotência: normalizar o resultado dá o mesmo resultado", () => {
  for (const bruto of ["38 BR", "33 - 34", "Nº 39", "37,5", "38.0", "35 ao 36"]) {
    const um = normalizarTamanho(bruto);
    assert.equal(um.ok, true, `esperava ok para "${bruto}"`);
    const dois = normalizarTamanho(um.valor);
    assert.equal(dois.valor, um.valor, `não idempotente para "${bruto}"`);
  }
});
