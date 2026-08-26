// Testes da faixa de ambiente.
//
// O que se prova: a faixa só aparece COM prova de staging, e todas as formas de
// "não sei" — leitura falhada, tabela ausente, linha vazia — se leem como
// produção. A direção do erro é escolhida, e é esta.
//
// Rodar: npx tsx --test src/modules/portal/domain/faixaDeAmbiente.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { faixaDeAmbiente, MARCA_DE_STAGING } from "./faixaDeAmbiente.ts";

test("staging mostra a faixa, e ela diz que os dados não são de loja real", () => {
  const f = faixaDeAmbiente(MARCA_DE_STAGING);
  assert.equal(f.mostrar, true);
  assert.match(f.texto, /staging/i);
  assert.match(f.texto, /não são de nenhuma loja real/i);
});

test("produção não tem a tabela: `null` não mostra nada", () => {
  // Este é o caso da produção — a tabela nem existe lá. Ver o cabeçalho do
  // módulo: em 26/08/2026 o lojista operou a conta que paga achando que era
  // teste, e a tela não dizia nada nas duas direções.
  assert.equal(faixaDeAmbiente(null).mostrar, false);
  assert.equal(faixaDeAmbiente(null).texto, "");
});

test("leitura vazia também se lê como produção", () => {
  assert.equal(faixaDeAmbiente("").mostrar, false);
  assert.equal(faixaDeAmbiente("   ").mostrar, false);
});

test("qualquer outra marca NÃO vira faixa de staging", () => {
  // "production", "dev", "homolog": nenhuma é prova de staging, e inventar uma
  // faixa a partir de valor desconhecido seria o mesmo erro ao contrário.
  assert.equal(faixaDeAmbiente("production").mostrar, false);
  assert.equal(faixaDeAmbiente("dev").mostrar, false);
  assert.equal(faixaDeAmbiente("homologacao").mostrar, false);
});

test("caixa e espaço não derrubam a prova — a marca é escrita à mão num SQL", () => {
  assert.equal(faixaDeAmbiente("Staging").mostrar, true);
  assert.equal(faixaDeAmbiente(" STAGING ").mostrar, true);
});
