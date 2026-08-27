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
  ehDeBebe,
  grupoDoProduto,
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

// ---------------------------------------------------------------------------
// Bebê é outro departamento no Mercado Livre — e por isso outro grupo
// ---------------------------------------------------------------------------

const BEBE = "MLB1400"; // Bebês > Roupas de Bebê > Calçados

test("bebê vira grupo próprio, separado do mesmo tipo adulto", () => {
  // Medido em 27/08/2026: 30 dos 321 chinelos são de bebê. Sem esta separação,
  // aprovar "chinelo -> Sandálias e Chinelos" mandava os 30 para o departamento
  // errado.
  assert.equal(grupoDoProduto("Chinelo Baby Ipanema 27543 Hello Kitty"), "chinelo baby");
  assert.equal(grupoDoProduto("Chinelo Havaianas Top Logomania 2"), "chinelo");
});

test("bebê é palavra inteira — 'babylook' não é bebê", () => {
  assert.equal(ehDeBebe("Sapatilha Babylook Feminina"), false);
  assert.equal(ehDeBebe("Chinelo Baby Dedo Ipanema"), true);
  assert.equal(ehDeBebe("Sandália Bebê Molekinha"), true);
});

test("infantil, kids e menina NÃO separam — o ML devolve a mesma categoria", () => {
  // Medido: "Chinelo Infantil Havaianas Disney" e "Chinelo Infantil Masculino
  // Ipanema" devolvem MLB273770, a mesma do adulto. Separar pelo que não muda
  // seria inventar grupo.
  assert.equal(grupoDoProduto("Chinelo Infantil Dedo Havaianas Disney"), "chinelo");
  assert.equal(grupoDoProduto("Chinelo Cartago 11858 Alabama Kids"), "chinelo");
  assert.equal(grupoDoProduto("Tênis Baby Menina Molekinha 2750.103"), "tenis baby");
});

test("o tipo sozinho continua existindo, e é a primeira palavra", () => {
  // `grupoDoProduto` é a CHAVE; `tipoDoProduto` continua sendo o tipo.
  assert.equal(tipoDoProduto("Chinelo Baby Ipanema"), "chinelo");
});

test("o voto do grupo de bebê é independente do grupo adulto", () => {
  const previsoes: PrevisaoDeCategoria[] = [
    ...Array.from({ length: 4 }, (_, i) => ({
      produtoId: `a${i}`, nome: `Chinelo Havaianas Modelo ${i}`, categoriaId: SANDALIAS,
    })),
    ...Array.from({ length: 3 }, (_, i) => ({
      produtoId: `b${i}`, nome: `Chinelo Baby Ipanema ${i}`, categoriaId: BEBE,
    })),
  ];
  const d = categoriasDecididas(previsoes);
  assert.equal(d.get("a0"), SANDALIAS);
  assert.equal(d.get("b0"), BEBE);
  assert.deepEqual(
    agruparPorTipo(previsoes).map((g) => g.tipo).sort(),
    ["chinelo", "chinelo baby"]
  );
});

test("nome vazio não vira grupo", () => {
  assert.equal(grupoDoProduto(""), "");
  assert.equal(grupoDoProduto("   "), "");
});

