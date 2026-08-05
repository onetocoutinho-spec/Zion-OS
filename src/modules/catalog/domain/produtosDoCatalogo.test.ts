// O catálogo em PDF não vira fonte de preço, nem de código.
//
// Um catálogo de fornecedor traz nome, medida, material, cor. Às vezes traz um
// PREÇO — que é o preço dele, não o custo da lojista nem o preço de venda dela.
// Herdar esse número é a versão mais cara da suposição-vestida-de-fato que a
// AUD-001 caçou, porque desta vez ela decide se a loja lucra.
//
// Estes testes guardam as três recusas que fazem a importação por PDF ser
// segura: preço não vem, código não se inventa, e produto sem nome não entra.

import test from "node:test";
import assert from "node:assert/strict";
import {
  linhasDoCatalogo,
  observacaoDaOrigem,
  resumoDoCatalogo,
  type ProdutoLidoDoCatalogo,
} from "./produtosDoCatalogo.ts";

const SOFA: ProdutoLidoDoCatalogo = {
  nome: "Sofá Retrátil 3 Lugares",
  marca: "Bom Lar",
  modelo: "BL-3000",
  paginaOrigem: 34,
  descricao: "Estrutura em eucalipto, espuma D28, tecido suede.",
  variacoes: [{ cor: "Cinza", tamanho: "2,10 m" }, { cor: "Bege", tamanho: "2,10 m" }],
};

test("preço e custo saem ZERADOS — o catálogo não é fonte de preço", () => {
  const [l] = linhasDoCatalogo([SOFA]);
  assert.equal(l.base.custo, 0);
  assert.equal(l.base.precoVenda, 0);
  for (const v of l.variacoes ?? []) {
    assert.equal(v.custo, 0, "o preço do fornecedor vazou para a variação");
    assert.equal(v.precoBase, 0);
  }
});

test("margem é null, não zero — sem custo não existe conta", () => {
  const [l] = linhasDoCatalogo([SOFA]);
  assert.equal(l.margem, null, "zero afirmaria uma margem que ninguém calculou");
});

test("SKU e EAN saem vazios — código plausível e falso vira pedido sem dono", () => {
  const [l] = linhasDoCatalogo([SOFA]);
  assert.equal(l.base.sku, "");
  for (const v of l.variacoes ?? []) {
    assert.equal(v.sku, "");
    assert.equal(v.ean, "");
  }
});

test("produto sem nome não entra — é cabeçalho ou rodapé lido como item", () => {
  const linhas = linhasDoCatalogo([
    SOFA,
    { nome: "   " },
    { nome: "" },
    { nome: "Mesa de Centro Oslo" },
  ]);
  assert.deepEqual(linhas.map((l) => l.base.nome), ["Sofá Retrátil 3 Lugares", "Mesa de Centro Oslo"]);
});

test("variação sem cor e sem tamanho é ruído de layout, não variação", () => {
  const [l] = linhasDoCatalogo([
    { nome: "Mesa Oslo", variacoes: [{ cor: "Nogueira" }, {}, { cor: "  ", tamanho: "" }] },
  ]);
  assert.equal(l.variacoes?.length, 1);
  assert.equal(l.variacoes?.[0]?.cor, "Nogueira");
});

test("produto sem variação nenhuma não ganha a chave — nem um array vazio", () => {
  const [l] = linhasDoCatalogo([{ nome: "Puff Redondo" }]);
  assert.equal(l.variacoes, undefined);
  assert.equal(l.base.cor, "");
  assert.equal(l.base.tamanho, "");
});

test("a página viaja na observação — é o que torna a conferência possível", () => {
  assert.match(observacaoDaOrigem(SOFA), /página 34/);
  assert.match(observacaoDaOrigem(SOFA), /eucalipto/);
  // Sem página, ainda diz de onde veio — mas não inventa um número.
  const semPagina = observacaoDaOrigem({ nome: "X" });
  assert.match(semPagina, /catálogo em PDF/);
  assert.ok(!/página/.test(semPagina), "inventou uma página que o modelo não declarou");
});

test("a primeira variação nomeia cor e tamanho do produto pai", () => {
  const [l] = linhasDoCatalogo([SOFA]);
  assert.equal(l.base.cor, "Cinza");
  assert.equal(l.base.tamanho, "2,10 m");
});

test("o resumo conta o que a lojista precisa saber antes de confirmar", () => {
  const lidos = [SOFA, { nome: "Puff Redondo" }];
  const r = resumoDoCatalogo(lidos, linhasDoCatalogo(lidos));
  assert.deepEqual(r, { produtos: 2, variacoes: 2, semPreco: 2, semPagina: 1 });
  // "sem preço em 100%" é ESPERADO vindo de PDF. O resumo existe para isso não
  // parecer defeito na tela.
  assert.equal(r.semPreco, r.produtos);
});

// ---------------------------------------------------------------------------
// A página real que reprovou o schema — Beliche VITORIA, catálogo de móveis.
//
// Ela chegou depois do schema pronto e mostrou dois campos que ele perdia:
// MATERIAL ("100% Madeira Maciça de Angelim") e as DIMENSÕES da peça montada,
// que na página estão num DESENHO TÉCNICO — 202 × 93 × 155 cm. Sem campo
// próprio, os três números virariam prosa dentro de `descricao` e seriam
// gravados como zero, porque `confirmarImportacaoProdutos` zerava altura,
// largura e comprimento sem ninguém ter dito zero.
//
// Em móvel a dimensão é o produto: decide o frete, que é a maior linha de custo
// da categoria, e é por ela que o comprador filtra.
// ---------------------------------------------------------------------------

const BELICHE: ProdutoLidoDoCatalogo = {
  nome: "Beliche - VITORIA",
  modelo: "VITORIA",
  material: "100% Madeira Maciça de Angelim",
  paginaOrigem: 12,
  dimensoes: { alturaCm: 155, larguraCm: 93, comprimentoCm: 202, pesoKg: null },
  descricao: "Pés com 8 cm de largura e 5 cm de profundidade. Sarrafo reforçado de 45x45 mm.",
  variacoes: [{ cor: "Castanho" }, { cor: "Mogno" }, { cor: "Cinamomo" }],
};

test("as três cores herdam a MESMA peça — a dimensão é do produto", () => {
  const [l] = linhasDoCatalogo([BELICHE]);
  assert.equal(l.variacoes?.length, 3);
  for (const v of l.variacoes ?? []) {
    assert.equal(v.alturaCm, 155);
    assert.equal(v.larguraCm, 93);
    assert.equal(v.comprimentoCm, 202);
  }
  assert.deepEqual(l.variacoes?.map((v) => v.cor), ["Castanho", "Mogno", "Cinamomo"]);
});

test("a medida que a página não mostrou não vira zero — ela não vai", () => {
  const [l] = linhasDoCatalogo([BELICHE]);
  // O catálogo não declara peso. Zero seria "pesa zero quilos", e o frete de um
  // beliche calculado sobre zero é o erro mais caro que esta categoria comporta.
  for (const v of l.variacoes ?? []) {
    assert.equal(v.pesoKg, undefined, "peso ausente virou um número");
  }
});

test("medida zerada ou negativa é descartada como se não existisse", () => {
  const [l] = linhasDoCatalogo([
    { ...BELICHE, dimensoes: { alturaCm: 0, larguraCm: -5, comprimentoCm: 202, pesoKg: null } },
  ]);
  const v = l.variacoes?.[0];
  assert.equal(v?.alturaCm, undefined);
  assert.equal(v?.larguraCm, undefined);
  assert.equal(v?.comprimentoCm, 202, "a medida boa foi descartada junto com as ruins");
});

test("o material vira atributo visível, não some dentro da prosa", () => {
  const obs = observacaoDaOrigem(BELICHE);
  assert.match(obs, /Material: 100% Madeira Maciça de Angelim/);
  assert.match(obs, /página 12/);
  assert.match(obs, /Sarrafo reforçado/);
});

// ---------------------------------------------------------------------------
// Cama BELLA — a página que derrubou o desenho anterior.
//
// O beliche tem um tamanho só, e por isso passou num modelo que prendia a
// dimensão ao PRODUTO. A BELLA é Solteiro (202 × 90 × 103) E Casal
// (202 × 143 × 103), cada uma nas mesmas três cores. Dimensão presa ao produto
// daria a medida da solteira à cama de casal — e frete de cama de casal cobrado
// como solteiro é dinheiro perdido em cada venda.
//
// Uma amostra de um caso é isto: um caso.
// ---------------------------------------------------------------------------

const BELLA: ProdutoLidoDoCatalogo = {
  nome: "Cama - BELLA",
  material: "100% Madeira Maciça de Eucalipto",
  paginaOrigem: 7,
  // Vazio de propósito: aqui a medida é da versão.
  dimensoes: { alturaCm: null, larguraCm: null, comprimentoCm: null, pesoKg: null },
  descricao: "Pés com 8 cm de largura e 6 cm de profundidade. Colchão casal 128 x 188 cm.",
  variacoes: [
    { cor: "Cinamomo", tamanho: "Solteiro", dimensoes: { alturaCm: 103, larguraCm: 90, comprimentoCm: 202 } },
    { cor: "Cinamomo", tamanho: "Casal", dimensoes: { alturaCm: 103, larguraCm: 143, comprimentoCm: 202 } },
  ],
};

test("cada versão fica com a MEDIDA DELA — solteiro não vira casal", () => {
  const [l] = linhasDoCatalogo([BELLA]);
  const solteiro = l.variacoes?.find((v) => v.tamanho === "Solteiro");
  const casal = l.variacoes?.find((v) => v.tamanho === "Casal");
  assert.equal(solteiro?.larguraCm, 90);
  assert.equal(casal?.larguraCm, 143, "a cama de casal herdou a largura da solteira");
  // O que as duas compartilham, compartilham mesmo.
  assert.equal(solteiro?.comprimentoCm, 202);
  assert.equal(casal?.comprimentoCm, 202);
});

test("a medida da versão VENCE a do produto quando as duas existem", () => {
  const [l] = linhasDoCatalogo([
    {
      ...BELLA,
      dimensoes: { alturaCm: 103, larguraCm: 90, comprimentoCm: 202, pesoKg: null },
      variacoes: [{ cor: "Mogno", tamanho: "Casal", dimensoes: { larguraCm: 143 } }],
    },
  ]);
  const v = l.variacoes?.[0];
  assert.equal(v?.larguraCm, 143, "a medida do produto sobrepôs a da versão");
  // E o que a versão não diz continua vindo do produto — não se perde.
  assert.equal(v?.comprimentoCm, 202);
  assert.equal(v?.alturaCm, 103);
});

test("produto de tamanho único continua descendo a medida para as cores", () => {
  const [l] = linhasDoCatalogo([BELICHE]);
  assert.equal(l.variacoes?.every((v) => v.larguraCm === 93), true);
});
