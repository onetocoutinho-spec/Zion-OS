// Testes do cabeçalho que não bate com os dados.
//
// O que se prova: o aviso só aparece quando há diferença de verdade, ele diz os
// números medidos, e nunca conserta nada — deslocar sozinho seria adivinhar qual
// coluna sobra.
//
// O caso real vem de um relatório do Linx de 27/08/2026: 11 nomes no cabeçalho,
// 9 campos em todas as 1505 linhas.
//
// Rodar: npx tsx --test src/modules/catalog/domain/cabecalhoDesalinhado.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { cabecalhoDesalinhado } from "./cabecalhoDesalinhado.ts";

/** N colunas com nome de verdade. */
const nomes = (n: number) => Array.from({ length: n }, (_, i) => `C${i}`);

test("cabeçalho e dados batendo não viram aviso", () => {
  const r = cabecalhoDesalinhado(nomes(9), [9, 9, 9]);
  assert.equal(r.desalinhado, false);
  assert.equal(r.texto, "");
});

test("o caso do Linx: 11 nomes, 9 campos em todas as linhas", () => {
  // Sem este aviso, PRECO recebia 25,13 (o custo) e QUANTIDADE recebia 46,90
  // (o preço). Dinheiro no campo errado, em silêncio.
  const r = cabecalhoDesalinhado(nomes(11), Array.from({ length: 1505 }, () => 9));
  assert.equal(r.desalinhado, true);
  assert.equal(r.colunasNoCabecalho, 11);
  assert.deepEqual(r.camposNasLinhas, [9]);
  assert.match(r.texto, /11 colunas/);
  assert.match(r.texto, /TODAS as 1505 linhas/);
  assert.match(r.texto, /9/);
});

test("o aviso diz o RISCO concreto, não 'formato inválido'", () => {
  const r = cabecalhoDesalinhado(nomes(11), [9]);
  assert.match(r.texto, /debaixo do nome errado/);
  assert.match(r.texto, /preço.*estoque|custo.*preço/i);
});

test("algumas linhas divergentes contam quantas são", () => {
  const r = cabecalhoDesalinhado(nomes(5), [5, 5, 4, 5]);
  assert.equal(r.desalinhado, true);
  assert.match(r.texto, /1 de 4 linhas/);
});

test("larguras diferentes entre si aparecem todas", () => {
  const r = cabecalhoDesalinhado(nomes(5), [3, 4, 3]);
  assert.deepEqual(r.camposNasLinhas, [3, 4]);
  assert.match(r.texto, /3, 4/);
});

test("linha MAIS LONGA que o cabeçalho também avisa", () => {
  // O excedente é descartado. Não desloca o que já casou, mas some com dado.
  const r = cabecalhoDesalinhado(nomes(3), [5, 5]);
  assert.equal(r.desalinhado, true);
});

test("arquivo sem linha de dados não vira aviso", () => {
  assert.equal(cabecalhoDesalinhado(nomes(11), []).desalinhado, false);
  assert.equal(cabecalhoDesalinhado([], [9]).desalinhado, false);
});

test("o aviso NÃO propõe conserto automático", () => {
  // Aqui sobra a primeira coluna; noutro relatório pode sobrar a última, ou
  // duas do meio. Deslocar sozinho gravaria com confiança um alinhamento
  // adivinhado — que é pior que o desalinhamento visível.
  const r = cabecalhoDesalinhado(nomes(11), [9]);
  assert.doesNotMatch(r.texto, /corrigi|ajustei|desloquei/i);
  assert.match(r.texto, /Confira/);
});

test("o `;` do fim NÃO é coluna que falta", () => {
  // O arquivo do Linx corrigido: 11 campos no cabeçalho porque a linha termina
  // em `;`, e 10 nas linhas. Nada está desalinhado — `CODIGO` traz código e
  // `PRECO` traz preço. Detector que grita nisso grita em quase todo relatório
  // de ERP, e alarme que sempre toca se aprende a ignorar.
  const comTerminador = [...nomes(10), ""];
  assert.equal(cabecalhoDesalinhado(comTerminador, Array.from({ length: 1505 }, () => 10)).desalinhado, false);
  // e a largura CHEIA também passa, para o arquivo que repete o terminador
  assert.equal(cabecalhoDesalinhado(comTerminador, [11, 11]).desalinhado, false);
});

test("nome vazio no MEIO continua contando", () => {
  // Ali some uma coluna com dado — é o caso que este detector existe para pegar.
  const comBuracoNoMeio = ["A", "", "C", "D"];
  assert.equal(cabecalhoDesalinhado(comBuracoNoMeio, [3, 3]).desalinhado, true);
});

test("o aviso conta as colunas NOMEADAS, não o terminador", () => {
  const r = cabecalhoDesalinhado([...nomes(10), ""], [8, 8]);
  assert.match(r.texto, /10 colunas/);
});

