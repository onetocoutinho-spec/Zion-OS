// Testes do tamanho tirado do nome da derivação, com prova.
//
// O que se prova: o corte usa o `Código Agrupador` como evidência de onde o
// tamanho começa, devolve o trecho ORIGINAL (com a pontuação que ele tiver), e
// devolve vazio quando a prova falta — nunca chuta "o número do fim".
//
// Os exemplos vêm da exportação real medida em 26/08/2026.
// Rodar: npx tsx --test src/modules/catalog/domain/tamanhoDaDerivacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { tamanhoDaDerivacao } from "./tamanhoDaDerivacao.ts";

test("o caso mais comum do arquivo real", () => {
  assert.equal(
    tamanhoDaDerivacao(
      "SANDALIA MOLEKINHA 2312.260 TURIM FEM (9583 ROSA/SILVER 35)",
      "1969985-9583ROSASILVER"
    ),
    "35"
  );
});

test("código com pontos e letras também casa — a comparação ignora pontuação", () => {
  assert.equal(
    tamanhoDaDerivacao("PAPETE (96781.NP.TAN1080/CAMEL 38)", "2035239-96781NPTAN1080CAMEL"),
    "38"
  );
});

test("cor com número no meio não engana", () => {
  // "PRETO 01/CAMEL 1" tem dois números que NÃO são tamanho. Pegar "o número do
  // fim" daria 1; a prova do agrupador dá 34.
  assert.equal(
    tamanhoDaDerivacao("BOTA (96782.FX/PRETO 01/CAMEL 1 34)", "2000000-96782FXPRETO01CAMEL1"),
    "34"
  );
});

test("tamanho com barra volta com a barra", () => {
  // A comparação é sem pontuação, mas o RETORNO é o original: "3738" seria
  // outro tamanho.
  assert.equal(
    tamanhoDaDerivacao("TENIS (ANSA black/black/white 37/38)", "9-ANSAblackblackwhite"),
    "37/38"
  );
});

test("sem agrupador, sem corte", () => {
  assert.equal(tamanhoDaDerivacao("SANDALIA (9583 ROSA/SILVER 35)", ""), "");
  assert.equal(tamanhoDaDerivacao("SANDALIA (9583 ROSA/SILVER 35)", undefined), "");
});

test("agrupador sem o traço não serve de prova", () => {
  // O formato é `<idPai>-<código e cor>`. Sem o traço não dá para saber o que é
  // id e o que é cor, e adivinhar aqui seria inventar a fronteira.
  assert.equal(tamanhoDaDerivacao("SANDALIA (9583 ROSA/SILVER 35)", "9583ROSASILVER"), "");
});

test("agrupador que NÃO é prefixo devolve vazio", () => {
  // As 13 linhas do arquivo real que não casaram. Sem prova, sem tamanho — e
  // vazio vira pergunta, que é o desfecho certo.
  assert.equal(
    tamanhoDaDerivacao("TENIS (black/black/white 37/38)", "9-blackblackwhiteansa"),
    ""
  );
});

test("nome sem parênteses devolve vazio", () => {
  assert.equal(tamanhoDaDerivacao("SANDALIA MOLEKINHA", "1969985-9583ROSASILVER"), "");
});

test("derivação que é SÓ o agrupador não inventa tamanho", () => {
  assert.equal(tamanhoDaDerivacao("X (9583 ROSA)", "1-9583ROSA"), "");
});

test("separador solto entre cor e tamanho é aparado", () => {
  assert.equal(tamanhoDaDerivacao("X (9583 ROSA - 35)", "1-9583ROSA"), "35");
});
