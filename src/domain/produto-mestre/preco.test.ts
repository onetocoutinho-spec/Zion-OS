// Testes de Preco — puros.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Preco } from "./preco.ts";
import { Dinheiro } from "../shared/value-objects/dinheiro.ts";

function d(v: number): Dinheiro {
  const r = Dinheiro.criar(v);
  if (!r.ok) throw new Error("valor de teste inválido");
  return r.valor;
}

test("publicavel = true quando preço >= piso", () => {
  const r = Preco.definir({ canal: "mercado_livre", preco: d(100), precoMinimo: d(80) });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.valor.publicavel, true);
});

test("publicavel = true quando preço == piso (limite)", () => {
  const r = Preco.definir({ canal: "mercado_livre", preco: d(80), precoMinimo: d(80) });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.valor.publicavel, true);
});

test("publicavel = false quando preço < piso (001 §9)", () => {
  const r = Preco.definir({ canal: "mercado_livre", preco: d(70), precoMinimo: d(80) });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.valor.publicavel, false);
});
