// Testes dos custos do lojista.
//
// O modelo cobrava comissão, taxa fixa e frete e chamava isso de custo da
// venda. Faltavam imposto, comissões internas, embalagem, etiqueta e
// informativos — 14 pontos percentuais e R$ 1,15 por pedido. Numa sandália de
// R$ 150 a margem caía de 20,7% para ~6%, e o sistema dizia "Saudável".
// Rodar: npx tsx --test src/modules/pricing/domain/custosDoLojista.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  custoPercentualEmReais,
  fixosDoLojista,
  normalizarCustos,
  percentuaisDoLojista,
  SEM_CUSTOS_DO_LOJISTA,
  temCustosInformados,
} from "./custosDoLojista.ts";

/** Os parâmetros reais da planilha da Chinelaria Leilane. */
const LEILANE = normalizarCustos({
  embalagem: 0.5,
  etiqueta: 0.15,
  informativos: 0.5,
  impostoPercentual: 12,
  comissaoGestorPercentual: 1,
  comissaoSistemaPercentual: 1,
  cupomPercentual: 0,
});

test("quem não preencheu nada calcula igual a antes", () => {
  assert.equal(fixosDoLojista(SEM_CUSTOS_DO_LOJISTA), 0);
  assert.equal(percentuaisDoLojista(SEM_CUSTOS_DO_LOJISTA), 0);
  assert.equal(temCustosInformados(SEM_CUSTOS_DO_LOJISTA), false);
});

test("os fixos da planilha somam R$ 1,15 por pedido", () => {
  assert.equal(fixosDoLojista(LEILANE), 1.15);
});

test("os percentuais da planilha somam 14 pontos", () => {
  // Imposto 12 + gestor 1 + ERP 1. É o que faltava no divisor do preço mínimo.
  assert.equal(percentuaisDoLojista(LEILANE), 14);
});

test("o caso real: 14% de R$ 150 são R$ 21", () => {
  assert.equal(custoPercentualEmReais(150, LEILANE), 21);
});

test("cupom entra nos percentuais, mas separado do imposto", () => {
  // Imposto é permanente; cupom é decisão de campanha. Somar os dois num
  // "outros %" esconderia que dá para desligar um e não o outro.
  const comCupom = normalizarCustos({ ...LEILANE, cupomPercentual: 10 });
  assert.equal(percentuaisDoLojista(comCupom), 24);
  assert.equal(comCupom.impostoPercentual, 12);
});

test("preço zero ou negativo não gera custo percentual", () => {
  assert.equal(custoPercentualEmReais(0, LEILANE), 0);
  assert.equal(custoPercentualEmReais(-10, LEILANE), 0);
});

// ---- Normalização: o que vem de fora não é confiável ----

test("valores ausentes, nulos ou lixo viram zero", () => {
  const c = normalizarCustos({ embalagem: NaN, impostoPercentual: undefined });
  assert.equal(c.embalagem, 0);
  assert.equal(c.impostoPercentual, 0);
  assert.deepEqual(normalizarCustos(null), SEM_CUSTOS_DO_LOJISTA);
  assert.deepEqual(normalizarCustos(undefined), SEM_CUSTOS_DO_LOJISTA);
});

test("negativo não vira desconto", () => {
  // Um custo negativo aumentaria a margem — dinheiro aparecendo do nada.
  const c = normalizarCustos({ embalagem: -5, impostoPercentual: -12 });
  assert.equal(c.embalagem, 0);
  assert.equal(c.impostoPercentual, 0);
});

test("percentual de 100 ou mais é RECUSADO", () => {
  // Um imposto de 1200% viria de um campo digitado errado. Aceitar
  // transformaria a tela num gerador de preços absurdos — o mesmo silêncio que
  // já gravou R$ 30 milhões de custo.
  assert.equal(normalizarCustos({ impostoPercentual: 1200 }).impostoPercentual, 0);
  assert.equal(normalizarCustos({ impostoPercentual: 100 }).impostoPercentual, 0);
  assert.equal(normalizarCustos({ impostoPercentual: 99.9 }).impostoPercentual, 99.9);
});

test("valor em texto (veio de formulário) ainda é lido", () => {
  const c = normalizarCustos({ embalagem: "0,5" as unknown as number });
  // "0,5" não é número em JS — vira 0, e não um valor inventado.
  assert.equal(c.embalagem, 0);
  const ok = normalizarCustos({ embalagem: "0.5" as unknown as number });
  assert.equal(ok.embalagem, 0.5);
});

test("temCustosInformados vê tanto fixo quanto percentual", () => {
  assert.equal(temCustosInformados(normalizarCustos({ embalagem: 0.5 })), true);
  assert.equal(temCustosInformados(normalizarCustos({ impostoPercentual: 12 })), true);
  assert.equal(temCustosInformados(LEILANE), true);
});
