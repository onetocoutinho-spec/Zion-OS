// Testes de Ean — puros. Rodar: node --test src/domain/shared/value-objects/ean.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { Ean } from "./ean.ts";

test("aceita EAN-13 válido", () => {
  // 7891234567895 é um GTIN-13 com dígito verificador correto
  const r = Ean.criar("7891234567895");
  assert.equal(r.ok, true, r.ok ? "" : r.erro.mensagem);
});

test("aceita GTIN-8 válido", () => {
  // 40170725 é um GTIN-8 válido conhecido
  const r = Ean.criar("40170725");
  assert.equal(r.ok, true);
});

test("rejeita dígito verificador errado", () => {
  const r = Ean.criar("7891234567890");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "ean_invalido");
});

test("rejeita tamanho/caracteres inválidos", () => {
  assert.equal(Ean.criar("123").ok, false);
  assert.equal(Ean.criar("78912A4567895").ok, false);
  assert.equal(Ean.criar("").ok, false);
});
