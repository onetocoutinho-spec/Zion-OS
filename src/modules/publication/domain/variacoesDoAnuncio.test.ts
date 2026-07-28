// Testes da grade do anúncio.
//
// Os dois casos que abrem este arquivo foram medidos na base real da lojista,
// não inventados: a esteira pedia `variacoes` à IA como campo obrigatório sem
// mandar variação nenhuma, e o modelo preencheu com dado plausível e falso.
// Rodar: npx tsx --test src/modules/publication/domain/variacoesDoAnuncio.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  briefingDaGrade,
  gradePublicavel,
  montarVariacoes,
  pendenciasDaGrade,
  FALTA,
  type VarianteDaBase,
} from "./variacoesDoAnuncio.ts";

/** A grade real do Babuche Molekinha 22591.408, como está na base. */
const BABUCHE: VarianteDaBase[] = [
  { cor: "Branco", tamanho: "25/26", sku: "01040525", ean: "", estoque: 3, precoBase: 0 },
  { cor: "Branco", tamanho: "27/28", sku: "01040527", ean: "", estoque: 0, precoBase: 0 },
  { cor: "Branco", tamanho: "29/30", sku: "01040529", ean: "", estoque: 5, precoBase: 0 },
];

test("a grade sai da BASE — cor, tamanho e SKU reais", () => {
  // O anúncio gerado dizia cor "Arco Iris" (que veio do NOME do produto),
  // tamanhos 19/20…29/30 e SKU "22591.408-ARCOIRIS-19/20". Nada disso existe.
  const g = montarVariacoes(BABUCHE, 118);
  assert.equal(g.length, 3);
  assert.deepEqual(g.map((v) => v.cor), ["Branco", "Branco", "Branco"]);
  assert.deepEqual(g.map((v) => v.tamanho), ["25/26", "27/28", "29/30"]);
  assert.deepEqual(g.map((v) => v.sku), ["01040525", "01040527", "01040529"]);
});

test("o que falta sai MARCADO, não preenchido", () => {
  const g = montarVariacoes(BABUCHE, 118);
  for (const v of g) assert.ok(v.ean.startsWith(FALTA), "EAN ausente deveria vir marcado");
});

test("estoque ZERO é fato, não ausência", () => {
  // Esgotado é uma informação, e das importantes. Tratar como desconhecido
  // esconderia justamente o que precisa ser visto antes de publicar.
  const g = montarVariacoes(BABUCHE, 118);
  assert.equal(g[1].estoque, "0");
  assert.equal(g[0].estoque, "3");
});

test("preço zero é ausência — produto sem preço não é de graça", () => {
  const g = montarVariacoes([{ ...BABUCHE[0], precoBase: 0 }], 0);
  assert.ok(g[0].preco.startsWith(FALTA));
});

test("preço da variação ganha do preço do produto", () => {
  const g = montarVariacoes([{ ...BABUCHE[0], precoBase: 99.9 }], 118);
  assert.equal(g[0].preco, "99.90");
});

test("sem variação nenhuma, a grade é VAZIA — não se inventa uma linha padrão", () => {
  // Inventar aqui seria repetir em código o erro que o modelo cometia.
  assert.deepEqual(montarVariacoes([], 118), []);
});

test("pendência é uma por CAMPO, não uma por variação", () => {
  // 26 variações sem EAN gerariam 26 linhas idênticas, e lista assim não é
  // lida — é ignorada.
  const p = pendenciasDaGrade(montarVariacoes(BABUCHE, 118));
  assert.equal(p.length, 1);
  assert.match(p[0], /EAN/);
  assert.match(p[0], /nenhuma das 3/);
});

test("falta parcial diz em quantas de quantas", () => {
  const meio = montarVariacoes(
    [BABUCHE[0], { ...BABUCHE[1], sku: "" }, BABUCHE[2]],
    118
  );
  const p = pendenciasDaGrade(meio);
  const sku = p.find((x) => /SKU/.test(x));
  assert.ok(sku);
  assert.match(sku, /falta em 1 de 3/);
});

test("grade ausente é a PRIMEIRA pendência — ela impede todas as outras", () => {
  const p = pendenciasDaGrade([]);
  assert.equal(p.length, 1);
  assert.match(p[0], /grade de variações/);
});

test("grade só é publicável quando existe e está inteira", () => {
  assert.equal(gradePublicavel([]), false);
  assert.equal(gradePublicavel(montarVariacoes(BABUCHE, 118)), false); // falta EAN
  const completa = montarVariacoes(
    [{ cor: "Preto", tamanho: "37/38", sku: "X1", ean: "789", estoque: 2, precoBase: 62 }],
    62
  );
  assert.equal(gradePublicavel(completa), true);
});

test("o briefing entrega a grade REAL e proíbe escrevê-la", () => {
  // Sem isto a tabela de medidas do Babuche saiu com 19/20 a 29/30 enquanto a
  // base tem 25/26 a 29/30: o texto certo para o produto errado.
  const b = briefingDaGrade(montarVariacoes(BABUCHE, 118));
  assert.match(b, /25\/26, 27\/28, 29\/30/);
  assert.match(b, /Branco/);
  assert.match(b, /NÃO escreva a lista de variações/);
  // O que falta não vaza para o briefing como se fosse valor.
  assert.doesNotMatch(b, new RegExp(FALTA));
});

test("briefing sem grade diz que não há, em vez de omitir", () => {
  assert.match(briefingDaGrade([]), /nenhuma variação cadastrada/);
});

test("o briefing diz que SKU já está resolvido — senão a IA pede de novo", () => {
  // Medido contra o Gemini: sem esta linha ele devolvia "⚠️ SKU para variação
  // 25/26 Branco" de um produto cujo SKU está no cadastro. Pendência FALSA
  // trava a publicação para sempre, porque publicar exige a lista vazia.
  const b = briefingDaGrade(montarVariacoes(BABUCHE, 118));
  assert.match(b, /SKU: já cadastrado nas 3 variações/);
  assert.match(b, /EAN: ausente em todas/);
  assert.match(b, /não repita/);
});

test("o briefing proíbe pendência de identidade, com ou sem grade", () => {
  for (const b of [briefingDaGrade(montarVariacoes(BABUCHE, 118)), briefingDaGrade([])]) {
    assert.match(b, /NÃO liste pendências sobre cor, tamanho, SKU, EAN/);
  }
});

test("SKU parcial é reportado como parcial, não como ausente", () => {
  const meio = montarVariacoes([BABUCHE[0], { ...BABUCHE[1], sku: "" }, BABUCHE[2]], 118);
  assert.match(briefingDaGrade(meio), /SKU: cadastrado em 2 de 3/);
});

test("cor vazia na base vira marca, não string vazia", () => {
  // String vazia num campo do ML passa como valor válido e some do relatório.
  const g = montarVariacoes([{ ...BABUCHE[0], cor: "  " }], 118);
  assert.ok(g[0].cor.startsWith(FALTA));
});
