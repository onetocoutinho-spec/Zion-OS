// Testes da idempotency_key — puros e determinísticos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveIdempotencia } from "./operacao.ts";

test("mesma entrada → mesma chave (determinístico)", () => {
  const a = chaveIdempotencia(["pm-1", "mercado_livre", "conta-1"]);
  const b = chaveIdempotencia(["pm-1", "mercado_livre", "conta-1"]);
  assert.equal(a, b);
});

test("entradas diferentes → chaves diferentes", () => {
  const a = chaveIdempotencia(["pm-1", "mercado_livre"]);
  const b = chaveIdempotencia(["pm-2", "mercado_livre"]);
  assert.notEqual(a, b);
});

test("separador não colide (percent-encoding das partes)", () => {
  // Sem encoding, ["a|b","c"] e ["a","b|c"] gerariam a mesma string "a|b|c".
  const a = chaveIdempotencia(["a|b", "c"]);
  const b = chaveIdempotencia(["a", "b|c"]);
  assert.notEqual(a, b);
});

test("normaliza espaços nas bordas das partes", () => {
  assert.equal(chaveIdempotencia([" pm-1 ", "x"]), chaveIdempotencia(["pm-1", "x"]));
});
