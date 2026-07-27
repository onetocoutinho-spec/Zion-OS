// Testes dos custos do Mercado Livre.
//
// Os valores esperados aqui vêm da TABELA OFICIAL (ver tabelaEnvioML.ts), não
// de estimativa de terceiros. Se o ML mudar a tabela, estes testes quebram —
// que é exatamente o que deve acontecer.
// Rodar: npx tsx --test src/modules/pricing/domain/custosML.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  pesoCobravelGramas,
  custoDeEnvio,
  comissaoDoAnuncio,
  COMISSAO_MODA,
  LIMIAR_FRETE_GRATIS,
} from "./custosML.ts";

// ── Peso cobrável: o maior entre real e cubado ───────────────────────────────

test("caixa volumosa e leve é cobrada pelo VOLUME, não pela balança", () => {
  // Caixa de chinelo: 30×20×10 = 6000 cm³ → 1000 g cubados contra 400 g reais.
  const cobravel = pesoCobravelGramas({
    pesoGramas: 400,
    alturaCm: 10,
    larguraCm: 20,
    comprimentoCm: 30,
  });
  assert.equal(cobravel, 1000);
});

test("produto denso e pequeno é cobrado pelo peso real", () => {
  const cobravel = pesoCobravelGramas({
    pesoGramas: 2000,
    alturaCm: 5,
    larguraCm: 10,
    comprimentoCm: 10,
  });
  assert.equal(cobravel, 2000); // cubado = 500/6000×1000 ≈ 83 g
});

test("sem medidas, o peso real prevalece — nunca se infla por falta de dado", () => {
  const cobravel = pesoCobravelGramas({
    pesoGramas: 350,
    alturaCm: 0,
    larguraCm: 0,
    comprimentoCm: 0,
  });
  assert.equal(cobravel, 350);
});

// ── Custo de envio: matriz peso × preço ──────────────────────────────────────

test("o envio incide TAMBÉM abaixo do limiar — não é zero lá", () => {
  // A página oficial: "se aplica a todas as vendas, mesmo que o comprador
  // pague pelo envio". O modelo anterior zerava isto e errava por baixo.
  const c = custoDeEnvio(300, 50);
  assert.ok(c !== null && c > 0, `esperado custo > 0 abaixo do limiar, veio ${c}`);
  assert.equal(c, 7.75); // 0,3 kg × faixa R$ 49 a R$ 78,99, tabela verde
});

test("no limiar o custo SALTA — é quando o frete grátis vira do vendedor", () => {
  const abaixo = custoDeEnvio(300, LIMIAR_FRETE_GRATIS - 0.01)!;
  const acima = custoDeEnvio(300, LIMIAR_FRETE_GRATIS)!;
  assert.equal(abaixo, 7.75);
  assert.equal(acima, 12.35);
  assert.ok(acima > abaixo * 1.5);
});

test("o MESMO peso custa mais quando o produto é mais caro", () => {
  // O preço entra duas vezes na conta: pela comissão e pela faixa de envio.
  assert.equal(custoDeEnvio(300, 90), 12.35);
  assert.equal(custoDeEnvio(300, 250), 20.95);
});

test("a caixa de chinelo cubada cai numa faixa de peso mais cara", () => {
  const peso = pesoCobravelGramas({
    pesoGramas: 400,
    alturaCm: 10,
    larguraCm: 20,
    comprimentoCm: 30,
  });
  assert.equal(custoDeEnvio(peso, 110), 16.15); // faixa "De 0,5 a 1 kg"
  // Se fosse pelo peso real de 400 g, cairia na faixa anterior e mais barata.
  assert.equal(custoDeEnvio(400, 110), 15.45);
});

test("reputação escolhe a tabela — laranja paga bem mais que verde", () => {
  const verde = custoDeEnvio(300, 110, "verde")!;
  const amarela = custoDeEnvio(300, 110, "amarela")!;
  const laranja = custoDeEnvio(300, 110, "laranja")!;
  assert.equal(verde, 14.35);
  assert.equal(amarela, 17.22);
  assert.equal(laranja, 28.7);
  assert.ok(verde < amarela && amarela < laranja);
});

test("abaixo de R$ 19 o envio custa no máximo METADE do preço", () => {
  // Sem esse teto, um item de R$ 8 pagaria R$ 5,65 — 71% do próprio preço.
  assert.equal(custoDeEnvio(300, 8), 4);
  assert.equal(custoDeEnvio(300, 10), 5);
  // Em R$ 19 o teto já não vale: passa a valer a tabela cheia.
  assert.equal(custoDeEnvio(300, 19), 6.55);
});

test("peso acima de 150 kg cai na última faixa, sem estourar", () => {
  assert.equal(custoDeEnvio(200000, 250), 261.95);
});

test("preço zero não gera custo, e entrada inválida devolve null", () => {
  assert.equal(custoDeEnvio(300, 0), 0);
  assert.equal(custoDeEnvio(-1, 50), null);
  assert.equal(custoDeEnvio(300, -1), null);
});

// ── Comissão ─────────────────────────────────────────────────────────────────

test("Premium é o padrão do canal; Clássico é mais barato", () => {
  assert.equal(comissaoDoAnuncio(undefined), 19);
  assert.equal(comissaoDoAnuncio("Premium"), 19);
  assert.equal(comissaoDoAnuncio("Clássico"), 14);
  assert.equal(COMISSAO_MODA.premium, 19);
});

test("outra categoria entra como parâmetro, não como número solto", () => {
  assert.equal(comissaoDoAnuncio("Premium", { classico: 11, premium: 16 }), 16);
});
