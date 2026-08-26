// Testes do voto do catálogo sobre a categoria do Mercado Livre.
//
// O que se prova: o grupo corrige o palpite-lixo do preditor, grupo pequeno NÃO
// vota, empate não manda em ninguém, e produto sem resposta não ganha categoria
// inventada.
//
// Os nomes e as previsões vêm de uma medição real de 26/08/2026 — 201 produtos
// consultados no `domain_discovery` do ML.
//
// Rodar: npx tsx --test src/modules/catalog/domain/categoriaPorTipo.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MINIMO_DO_GRUPO,
  agruparPorTipo,
  categoriasDecididas,
  tipoDoProduto,
  type PrevisaoDeCategoria,
} from "./categoriaPorTipo.ts";

const SANDALIAS = "MLB273770";
const AGUA = "MLB269718";
const TENIS = "MLB23332";

/**
 * Os 15 papetes da medição real de 26/08/2026: 11 o preditor acerta e 4 ele
 * manda para Águas Minerais. Nomes e respostas são os que o ML devolveu.
 */
function papetes(): PrevisaoDeCategoria[] {
  const bons = [
    "Papete Slide Moleca 5469.135 Sag Strass",
    "Papete Molekinha 2358.108 TP Strass",
    "Papete Slide Modare 7200.103 Strass / Tira",
    "Papete Slide Molekinha 2358.103 Strass Kids",
    "Papete Vizzano 6510.124 Pelica",
    "Papete Birken Moleca 5436.441 Flex",
    "Papete Moleca 5500.215 It\xe1lia",
    "papete beira rio 8488.105 flex camurca",
    "Papete Slide Feminina Moleca 5556.100 t/pro/cac",
    "Papete Slide Feminina Moleca Suprema 5490.132",
    "Papete Slide Feminina Modare Suprema 7208.113"
  ].map((nome, i) => ({ produtoId: `b${i}`, nome, categoriaId: SANDALIAS }));
  const ruins = [
    "Papete Slide Modare 7208.101 Nobuck",
    "Papete Slide Zaxy 18063 Partner Lisa",
    "Papete Zaxy 19429 Charms",
    "papete slide zaxy 19281 fire"
  ].map((nome, i) => ({ produtoId: `r${i}`, nome, categoriaId: AGUA }));
  return [...bons, ...ruins];
}

test("o tipo é a primeira palavra com 3+ letras", () => {
  assert.equal(tipoDoProduto("Papete Slide Modare 7208.101 Nobuck"), "papete");
  assert.equal(tipoDoProduto("Sándalia Molekinha 2312.260 Turim"), "sandalia");
  assert.equal(tipoDoProduto("papete beira rio 8488.105"), "papete");
});

test("número na frente do nome não vira tipo", () => {
  assert.equal(tipoDoProduto("2312 Sandalia Molekinha"), "sandalia");
});

test("o grupo corrige o palpite-lixo do preditor", () => {
  // 4 papetes preveem Sandálias e 3 preveem Águas Minerais. Medido no arquivo
  // real: 7 produtos viraram água mineral, e o voto derrubou 5 deles.
  const decidido = categoriasDecididas(papetes());
  assert.equal(decidido.get("r0"), SANDALIAS);
  assert.equal(decidido.get("b0"), SANDALIAS);
  assert.equal([...decidido.values()].filter((v) => v === AGUA).length, 0);
});

test("o grupo mostra quantos divergiram — a lojista precisa ver isso", () => {
  const [g] = agruparPorTipo(papetes());
  assert.equal(g.tipo, "papete");
  assert.equal(g.categoriaId, SANDALIAS);
  assert.equal(g.concordam, 11);
  assert.equal(g.divergem, 4);
});

test("grupo pequeno NÃO vota — três não são repetição", () => {
  const poucos: PrevisaoDeCategoria[] = [
    { produtoId: "a", nome: "Bolsa Moleca 50042.1", categoriaId: "MLB7022" },
    { produtoId: "b", nome: "Bolsa Moleca 50046.2", categoriaId: AGUA },
  ];
  const [g] = agruparPorTipo(poucos);
  assert.equal(g.pequenoDemais, true);
  assert.equal(g.categoriaId, "");
  // Cada um fica com o que previu, inclusive o errado: sem grupo não há prova.
  const d = categoriasDecididas(poucos);
  assert.equal(d.get("a"), "MLB7022");
  assert.equal(d.get("b"), AGUA);
});

test("o mínimo do grupo é o que a constante diz", () => {
  const nomes = Array.from({ length: MINIMO_DO_GRUPO }, (_, i) => ({
    produtoId: `x${i}`, nome: `Chinelo Marca ${i}`, categoriaId: SANDALIAS,
  }));
  assert.equal(agruparPorTipo(nomes)[0].pequenoDemais, false);
  assert.equal(agruparPorTipo(nomes.slice(1))[0].pequenoDemais, true);
});

test("empate não manda em ninguém", () => {
  // 2 x 2 não é maioria. Sem maioria, cada um fica com o seu.
  const empate: PrevisaoDeCategoria[] = [
    { produtoId: "a", nome: "Tenis A", categoriaId: TENIS },
    { produtoId: "b", nome: "Tenis B", categoriaId: TENIS },
    { produtoId: "c", nome: "Tenis C", categoriaId: SANDALIAS },
    { produtoId: "d", nome: "Tenis D", categoriaId: SANDALIAS },
  ];
  const [g] = agruparPorTipo(empate);
  assert.equal(g.categoriaId, "");
  assert.equal(categoriasDecididas(empate).get("c"), SANDALIAS);
});

test("sem resposta do ML e sem grupo, o produto fica SEM categoria", () => {
  const mudo: PrevisaoDeCategoria[] = [{ produtoId: "z", nome: "Coisa Estranha", categoriaId: "" }];
  assert.equal(categoriasDecididas(mudo).has("z"), false);
});

test("sem resposta, mas com grupo, o grupo empresta", () => {
  const p = [...papetes(), { produtoId: "novo", nome: "Papete Sem Resposta", categoriaId: "" }];
  assert.equal(categoriasDecididas(p).get("novo"), SANDALIAS);
  assert.equal(agruparPorTipo(p)[0].semResposta, 1);
});

test("os grupos saem do maior para o menor — é a ordem de quem revisa", () => {
  const mistura: PrevisaoDeCategoria[] = [
    ...papetes(),
    { produtoId: "m1", nome: "Meia Olympikus 81919", categoriaId: "MLB108791" },
  ];
  const g = agruparPorTipo(mistura);
  assert.equal(g[0].tipo, "papete");
  assert.equal(g[g.length - 1].tipo, "meia");
});
