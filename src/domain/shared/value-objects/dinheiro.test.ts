// Testes de Dinheiro — puros. Rodar: node --test src/domain/shared/value-objects/dinheiro.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { Dinheiro } from "./dinheiro.ts";

test("criar: valor em reais vira centavos inteiros", () => {
  const r = Dinheiro.criar(129.9);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.valor.centavos, 12990);
    assert.equal(r.valor.valor, 129.9);
  }
});

test("criar: arredonda para o centavo mais próximo (sem erro de float)", () => {
  const r = Dinheiro.criar(0.1 + 0.2); // 0.30000000000000004
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.valor.centavos, 30);
});

test("criar: rejeita negativo", () => {
  const r = Dinheiro.criar(-1);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "valor_monetario_invalido");
});

test("criar: rejeita não-finito", () => {
  assert.equal(Dinheiro.criar(Number.NaN).ok, false);
  assert.equal(Dinheiro.criar(Number.POSITIVE_INFINITY).ok, false);
});

test("comparações e igualdade", () => {
  const a = Dinheiro.criar(10);
  const b = Dinheiro.criar(20);
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) {
    assert.equal(a.valor.menorQue(b.valor), true);
    assert.equal(b.valor.maiorQue(a.valor), true);
    assert.equal(a.valor.igualA(Dinheiro.zero()), false);
  }
});
