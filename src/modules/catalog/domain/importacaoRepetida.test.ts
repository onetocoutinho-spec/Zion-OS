// Testes do aviso de importação repetida.
//
// O que se prova: o aviso conta PRODUTOS e não linhas, reconhece o mesmo código
// escrito de outro jeito, mostra o código como a pessoa o conhece, e cala a boca
// quando não há repetição. E nunca decide nada — não existe "bloquear" aqui.
//
// Rodar: npx tsx --test src/modules/catalog/domain/importacaoRepetida.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EXEMPLOS_MOSTRADOS,
  conferirImportacaoRepetida,
} from "./importacaoRepetida.ts";

test("catálogo vazio: nada a avisar", () => {
  const r = conferirImportacaoRepetida(["100", "200"], []);
  assert.equal(r.repetidos, 0);
  assert.equal(r.novos, 2);
  assert.equal(r.texto, "");
});

test("a planilha inteira já está no catálogo — o caso da reimportação", () => {
  // Foi o que aconteceu em 26/08/2026: a mesma planilha subiria de novo e
  // deixaria 2006 produtos onde havia 1003.
  const r = conferirImportacaoRepetida(["100", "200"], ["100", "200", "300"]);
  assert.equal(r.repetidos, 2);
  assert.equal(r.novos, 0);
  assert.match(r.texto, /2 produtos/);
  assert.match(r.texto, /Nenhum produto desta planilha é novo/);
});

test("mistura de novos e repetidos diz os dois números", () => {
  const r = conferirImportacaoRepetida(["100", "200", "999"], ["100", "200"]);
  assert.equal(r.repetidos, 2);
  assert.equal(r.novos, 1);
  assert.match(r.texto, /Os outros 1 são novos/);
});

test("o aviso diz que DUPLICA — e não que substitui", () => {
  // A frase precisa dizer o que o sistema faz, não o que a pessoa espera. O
  // `insert` é puro: não há upsert, e o banco não tem índice único em
  // (cliente_id, cod_erp) que segurasse.
  const r = conferirImportacaoRepetida(["100"], ["100"]);
  assert.match(r.texto, /OUTRA VEZ, em duplicidade/);
  assert.match(r.texto, /não substitui/);
});

test("o mesmo código escrito de outro jeito é o mesmo produto", () => {
  const r = conferirImportacaoRepetida([" 01003335 "], ["01003335"]);
  assert.equal(r.repetidos, 1);
});

test("linha repetida na própria planilha conta UM produto", () => {
  // A pergunta é sobre produtos, não sobre linhas — uma grade de 40 numerações
  // manda 40 linhas com o mesmo SKU Pai.
  const r = conferirImportacaoRepetida(["100", "100", "100"], ["100"]);
  assert.equal(r.repetidos, 1);
  assert.match(r.texto, /1 produto /);
});

test("o exemplo sai como a pessoa conhece o código, não normalizado", () => {
  // Ela vai procurar "AB-1003" no ERP dela; "ab-1003" sairia descaracterizado.
  const r = conferirImportacaoRepetida(["AB-1003"], ["ab-1003"]);
  assert.deepEqual(r.exemplos, ["AB-1003"]);
});

test("mostra poucos exemplos, e avisa que há mais", () => {
  const muitos = Array.from({ length: 10 }, (_, i) => `c${i}`);
  const r = conferirImportacaoRepetida(muitos, muitos);
  assert.equal(r.exemplos.length, EXEMPLOS_MOSTRADOS);
  assert.match(r.texto, /entre outros/);
});

test("código vazio não é produto", () => {
  // Linha sem SKU Pai não vira aviso: ela não identifica nada.
  const r = conferirImportacaoRepetida(["", "  ", "100"], ["100"]);
  assert.equal(r.repetidos, 1);
  assert.equal(r.novos, 0);
});
