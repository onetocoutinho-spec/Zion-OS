// Testes das ambiguidades pendentes.
//
// O lojista reimportou a planilha, viu "17 ambíguos", saiu da tela e voltou —
// e não havia mais nada. A lista vivia no estado do componente.
// Rodar: npx tsx --test src/modules/catalog/domain/ambiguidadesPendentes.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ambiguidadesAindaAbertas,
  chaveAmbiguidades,
  lerAmbiguidades,
  semOProduto,
  type AmbiguidadePendente,
} from "./ambiguidadesPendentes.ts";

const item = (id: string, n = 2): AmbiguidadePendente => ({
  produtoId: id,
  produto: `Produto ${id}`,
  candidatos: Array.from({ length: n }, (_, i) => ({ custo: 10 + i, origem: `linha ${i}` })),
});

test("ida e volta pelo JSON preserva o que importa", () => {
  const lista = [item("p1"), item("p2", 3)];
  assert.deepEqual(lerAmbiguidades(JSON.stringify(lista)), lista);
});

test("não confia no que veio do storage", () => {
  assert.deepEqual(lerAmbiguidades(null), []);
  assert.deepEqual(lerAmbiguidades(""), []);
  assert.deepEqual(lerAmbiguidades("{não é json"), []);
  assert.deepEqual(lerAmbiguidades('"texto"'), []);
  assert.deepEqual(lerAmbiguidades("{}"), []); // objeto, não lista
  assert.deepEqual(lerAmbiguidades(JSON.stringify([null, 7, "x"])), []);
});

test("item sem id ou sem candidatos é descartado, os bons ficam", () => {
  const bruto = JSON.stringify([
    { produto: "sem id", candidatos: [{ custo: 1 }, { custo: 2 }] },
    { produtoId: "p1", produto: "ok", candidatos: [{ custo: 10, origem: "a" }, { custo: 20, origem: "b" }] },
    { produtoId: "p2", produto: "sem candidatos", candidatos: [] },
  ]);
  const lido = lerAmbiguidades(bruto);
  assert.equal(lido.length, 1);
  assert.equal(lido[0].produtoId, "p1");
});

test("UM candidato só não é ambiguidade", () => {
  // Sem conflito não há o que decidir, e um botão sozinho faria a pessoa
  // "escolher" o óbvio à toa.
  const bruto = JSON.stringify([{ produtoId: "p1", produto: "x", candidatos: [{ custo: 10, origem: "a" }] }]);
  assert.deepEqual(lerAmbiguidades(bruto), []);
});

test("candidato com custo inválido não vira opção", () => {
  // Escolher zero gravaria "sem custo" achando que decidiu alguma coisa.
  const bruto = JSON.stringify([
    { produtoId: "p1", produto: "x", candidatos: [{ custo: 0, origem: "a" }, { custo: 10, origem: "b" }, { custo: "20", origem: "c" }] },
  ]);
  assert.deepEqual(lerAmbiguidades(bruto), []); // sobrou 1 válido → não é ambiguidade
});

test("produto que JÁ tem custo sai da lista", () => {
  // O custo pode ter chegado por outro caminho: outra importação, edição
  // manual, a escolha feita noutro navegador. Insistir seria pedir para decidir
  // de novo algo já decidido — e ruído ensina a ignorar a tela.
  const salvas = [item("p1"), item("p2"), item("p3")];
  const abertas = ambiguidadesAindaAbertas(salvas, new Set(["p2"]));
  assert.deepEqual(abertas.map((a) => a.produtoId), ["p1", "p3"]);
});

test("sem nada resolvido, a lista fica inteira", () => {
  const salvas = [item("p1"), item("p2")];
  assert.equal(ambiguidadesAindaAbertas(salvas, new Set()).length, 2);
});

test("semOProduto tira só quem foi decidido", () => {
  const lista = [item("p1"), item("p2")];
  assert.deepEqual(semOProduto(lista, "p1").map((a) => a.produtoId), ["p2"]);
  assert.deepEqual(semOProduto(lista, "inexistente").length, 2);
});

test("a chave separa clientes no mesmo navegador", () => {
  assert.notEqual(chaveAmbiguidades("a"), chaveAmbiguidades("b"));
  assert.equal(chaveAmbiguidades(""), "zion:custos:ambiguos:sem-cliente");
});
