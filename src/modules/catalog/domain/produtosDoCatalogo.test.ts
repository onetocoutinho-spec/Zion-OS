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
