// Testes da faixa de ambiente.
//
// O que se prova: a faixa só aparece COM prova de staging, e todas as formas de
// "não sei" — leitura falhada, tabela ausente, linha vazia — se leem como
// produção. A direção do erro é escolhida, e é esta.
//
// Rodar: npx tsx --test src/modules/portal/domain/faixaDeAmbiente.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MARCA_DE_PRODUCAO,
  MARCA_DE_STAGING,
  faixaDeAmbiente,
} from "./faixaDeAmbiente.ts";

test("staging mostra a faixa, e ela diz que os dados não são de loja real", () => {
  const f = faixaDeAmbiente(MARCA_DE_STAGING);
  assert.equal(f.mostrar, true);
  assert.match(f.texto, /staging/i);
  assert.match(f.texto, /não são de nenhuma loja real/i);
});

test("banco que não se identifica não vira faixa", () => {
  // `null` é "não sei" — e não sei não vira afirmação, em nenhuma direção.
  assert.equal(faixaDeAmbiente(null).mostrar, false);
  assert.equal(faixaDeAmbiente(null, true).mostrar, false);
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

// ---------------------------------------------------------------------------
// O terceiro caso: a máquina de quem desenvolve falando com a conta que paga
// ---------------------------------------------------------------------------

test("localhost + produção = faixa VERMELHA, e ela nomeia o engano", () => {
  // Em 26/08/2026 `npm run dev` carregou `.env.local`, que aponta para a
  // produção, e 16 produtos de uma loja real foram categorizados por engano.
  const f = faixaDeAmbiente(MARCA_DE_PRODUCAO, true);
  assert.equal(f.mostrar, true);
  assert.equal(f.tom, "perigo");
  assert.match(f.texto, /PRODUÇÃO/);
  assert.match(f.texto, /contas reais/);
  // A saída, no mesmo lugar do problema: quem lê o aviso precisa saber o que
  // fazer, e "use o staging" sem o comando é conselho sem endereço.
  assert.match(f.texto, /npm run dev:staging/);
});

test("produção FORA do localhost não diz nada — é a lojista no dia dela", () => {
  // Dizer "você está na produção" para quem só tem produção é ruído, e ruído se
  // aprende a ignorar — inclusive o que importa.
  assert.equal(faixaDeAmbiente(MARCA_DE_PRODUCAO).mostrar, false);
  assert.equal(faixaDeAmbiente(MARCA_DE_PRODUCAO, false).mostrar, false);
});

test("staging em localhost continua sendo staging, e não perigo", () => {
  // É o desfecho que a gente QUER de quem desenvolve: amarelo, não vermelho.
  const f = faixaDeAmbiente(MARCA_DE_STAGING, true);
  assert.equal(f.tom, "teste");
  assert.match(f.texto, /não são de nenhuma loja real/);
});

test("marca desconhecida em localhost também não vira perigo", () => {
  // Só `producao` é prova de produção. Inventar perigo a partir de valor
  // desconhecido seria o mesmo erro da faixa anterior, ao contrário.
  assert.equal(faixaDeAmbiente("homologacao", true).mostrar, false);
});

