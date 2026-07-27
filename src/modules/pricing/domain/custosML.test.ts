// Testes dos custos que dependem de peso e dimensão.
//
// A regra que guia este arquivo: onde falta dado, o resultado é null — nunca um
// número plausível. Um frete extrapolado da tabela vira preço errado no anúncio
// de um cliente real, e ninguém descobre até a margem sumir.
// Rodar: npx tsx --test src/modules/pricing/domain/custosML.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  pesoCobravelGramas,
  custoFixoPorPreco,
  fretePorPeso,
  comissaoDoAnuncio,
  COMISSAO_MODA,
  LIMIAR_FRETE_GRATIS,
  type TabelaFrete,
} from "./custosML.ts";

// Tabela de EXEMPLO, só para os testes. Os dois pontos conhecidos em jul/2026;
// não é a tabela oficial (que não existe de forma pública e estável).
const TABELA_EXEMPLO: TabelaFrete = [
  { atePesoGramas: 300, valor: 18.45 },
  { atePesoGramas: 5000, valor: 46 },
];

// ── Peso cobrável: o maior entre real e cubado ───────────────────────────────

test("caixa volumosa e leve é cobrada pelo VOLUME, não pela balança", () => {
  // Caixa de chinelo: 30×20×10 = 6000 cm³ → 1000 g cubados contra 400 g reais.
  // Este é exatamente o caso que a mudança de 2 de março de 2026 penaliza.
  const cobravel = pesoCobravelGramas({
    pesoGramas: 400,
    alturaCm: 10,
    larguraCm: 20,
    comprimentoCm: 30,
  });
  assert.equal(cobravel, 1000);
});

test("produto denso é cobrado pelo peso real", () => {
  // 30×10×5 = 1500 cm³ → 250 g cubados, contra 800 g reais.
  const cobravel = pesoCobravelGramas({
    pesoGramas: 800,
    alturaCm: 5,
    larguraCm: 10,
    comprimentoCm: 30,
  });
  assert.equal(cobravel, 800);
});

test("sem dimensões, o peso real prevalece — falta de dado não infla o frete", () => {
  const cobravel = pesoCobravelGramas({
    pesoGramas: 650,
    alturaCm: 0,
    larguraCm: 0,
    comprimentoCm: 0,
  });
  assert.equal(cobravel, 650);
});

// ── Custo fixo: por faixa de PREÇO, e só ABAIXO do limiar ────────────────────

test("o custo fixo segue a faixa de preço", () => {
  assert.equal(custoFixoPorPreco(15), 5.5);
  assert.equal(custoFixoPorPreco(20), 5.5);
  assert.equal(custoFixoPorPreco(20.01), 6);
  assert.equal(custoFixoPorPreco(78.99), 6);
});

test("no limiar e acima dele o custo fixo NÃO incide", () => {
  // O código antigo cobrava R$1,15 em todos os preços; a faixa era o oposto.
  assert.equal(custoFixoPorPreco(LIMIAR_FRETE_GRATIS), 0);
  assert.equal(custoFixoPorPreco(350), 0);
});

test("abaixo do mínimo vendável não há custo — não há venda", () => {
  assert.equal(custoFixoPorPreco(9.99), null);
  assert.equal(custoFixoPorPreco(0), null);
});

// ── Frete: da tabela, e null fora dela ───────────────────────────────────────

test("o frete sai da faixa de peso correspondente", () => {
  assert.equal(fretePorPeso(200, TABELA_EXEMPLO), 18.45);
  assert.equal(fretePorPeso(300, TABELA_EXEMPLO), 18.45);
  assert.equal(fretePorPeso(301, TABELA_EXEMPLO), 46);
  assert.equal(fretePorPeso(5000, TABELA_EXEMPLO), 46);
});

test("peso fora da tabela devolve null — não extrapola", () => {
  // A prova que justifica o arquivo inteiro: sem cobertura, sem palpite.
  assert.equal(fretePorPeso(5001, TABELA_EXEMPLO), null);
  assert.equal(fretePorPeso(-1, TABELA_EXEMPLO), null);
  assert.equal(fretePorPeso(500, []), null);
});

test("o subsídio do ML desconta sobre o valor de tabela", () => {
  assert.equal(fretePorPeso(300, TABELA_EXEMPLO, 50), 9.23);
  assert.equal(fretePorPeso(300, TABELA_EXEMPLO, 70), 5.54);
  assert.equal(fretePorPeso(300, TABELA_EXEMPLO, 0), 18.45);
});

test("subsídio fora da faixa 0–100 devolve null", () => {
  assert.equal(fretePorPeso(300, TABELA_EXEMPLO, 101), null);
  assert.equal(fretePorPeso(300, TABELA_EXEMPLO, -1), null);
});

// ── Comissão por tipo de anúncio ─────────────────────────────────────────────

test("a comissão segue o tipo de anúncio", () => {
  assert.equal(comissaoDoAnuncio("Clássico"), 14);
  assert.equal(comissaoDoAnuncio("Premium"), 19);
});

test("sem tipo, vale Premium — o mesmo default do canal", () => {
  // Espelha `canaisMarketplace.paraApp`: `tipo_anuncio ?? "Premium"`.
  assert.equal(comissaoDoAnuncio(undefined), COMISSAO_MODA.premium);
  assert.equal(comissaoDoAnuncio(null), COMISSAO_MODA.premium);
});
