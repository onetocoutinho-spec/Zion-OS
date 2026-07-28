// Testes do agrupamento por família.
//
// Existe para o lojista digitar o peso uma vez por LINHA de produto, e não 73
// vezes. Medido na base real: 73 produtos formam 42 famílias.
// Rodar: npx tsx --test src/modules/catalog/domain/familiaDeProduto.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  agruparPorFamilia,
  chaveDaFamilia,
  codigoDoModelo,
  contarComPeso,
  marcaDoNome,
} from "./familiaDeProduto.ts";

test("reconhece a marca dentro do nome", () => {
  assert.equal(marcaDoNome("Papete Slide Feminina Moleca 5556.100 Tira Pr"), "Moleca");
  assert.equal(marcaDoNome("Sandalia Baby Molekinho 2135.137 Fl Rust Neo"), "Molekinho");
  assert.equal(marcaDoNome("Chinelo Havaianas Masculino Brasil"), "Havaianas");
  assert.equal(marcaDoNome("Mochila Escolar Qualquer Coisa"), "");
});

test("Beira Rio vem antes de marcas mais curtas", () => {
  // A ordem da lista é a regra: uma marca que contém outra tem que ser testada
  // primeiro, senão o grupo sai errado.
  assert.equal(marcaDoNome("Papete Slide Beira Rio 8488.122 Wires"), "Beira Rio");
});

test("marca com acento e caixa diferente ainda casa", () => {
  assert.equal(marcaDoNome("TÊNIS ACTVITTA 4938.104 DUALA"), "Actvitta");
});

test("o código do modelo pega 4+ dígitos e os decimais junto", () => {
  assert.equal(codigoDoModelo("Moleca 5556.100 Tira Preta"), "5556.100");
  assert.equal(codigoDoModelo("Chinelo Cartago 11840 Atlanta"), "11840");
  assert.equal(codigoDoModelo("Papete Modare 7208.101 Nature"), "7208.101");
});

test("numeração de calçado NÃO é código de modelo", () => {
  // "25/6" e "39/40" agrupariam chinelo infantil com bota adulta.
  assert.equal(codigoDoModelo("Chinelo Havaianas Infantil Athletic 25/6"), "");
  assert.equal(codigoDoModelo("Meia 3/4 Lisa Puket"), "");
});

test("a chave junta marca e modelo, e degrada com elegância", () => {
  assert.equal(chaveDaFamilia("Papete Moleca 5556.100 Tira"), "Moleca 5556.100");
  assert.equal(chaveDaFamilia("Chinelo Havaianas Brasil"), "Havaianas");
  assert.equal(chaveDaFamilia("Produto Sem Marca 9911"), "9911");
  assert.equal(chaveDaFamilia("Coisa qualquer"), "");
});

test("cores diferentes da mesma linha caem no mesmo grupo", () => {
  // O caso que motiva o módulo: mesmo sapato, duas cores, um peso só.
  const g = agruparPorFamilia([
    { id: "1", nome: "Papete Slide Feminina Moleca 5556.100 Tira Pr Ca" },
    { id: "2", nome: "Papete Slide Feminina Moleca 5556.100 T/pro/cac" },
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].titulo, "Moleca 5556.100");
  assert.equal(g[0].produtos.length, 2);
});

test("modelos diferentes da mesma marca NÃO se juntam", () => {
  // 7142.106 e 7208.101 são sapatos diferentes; pesos podem divergir.
  const g = agruparPorFamilia([
    { id: "1", nome: "Tamanco Modare 7142.106 Tresse" },
    { id: "2", nome: "Papete Modare 7208.101 Nature" },
  ]);
  assert.equal(g.length, 2);
});

test("produto sem família fica sozinho, nunca num balaio de 'outros'", () => {
  // Juntar mochila com chinelo porque nenhum tinha marca conhecida seria o
  // pior resultado possível: um peso errado aplicado aos dois.
  const g = agruparPorFamilia([
    { id: "1", nome: "Coisa estranha" },
    { id: "2", nome: "Outra coisa estranha" },
  ]);
  assert.equal(g.length, 2);
  assert.equal(g[0].produtos.length, 1);
  assert.equal(g[0].titulo, "Coisa estranha");
});

test("a ordem de chegada é preservada", () => {
  const g = agruparPorFamilia([
    { id: "1", nome: "Chinelo Havaianas Top" },
    { id: "2", nome: "Tamanco Modare 7142.106" },
    { id: "3", nome: "Chinelo Havaianas Brasil" },
  ]);
  assert.deepEqual(g.map((f) => f.titulo), ["Havaianas", "Modare 7142.106"]);
  assert.equal(g[0].produtos.length, 2);
});

test("lista vazia não vira grupo nenhum", () => {
  assert.deepEqual(agruparPorFamilia([]), []);
});

test("contarComPeso conta só o que tem peso de verdade", () => {
  assert.equal(contarComPeso([{ pesoGramas: 400 }, { pesoGramas: 0 }, { pesoGramas: 350 }]), 2);
  assert.equal(contarComPeso([]), 0);
});
