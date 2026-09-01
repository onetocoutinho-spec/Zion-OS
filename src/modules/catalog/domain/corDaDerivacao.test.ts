// Testes da cor tirada do nome da derivação pela repetição entre produtos.
//
// O que se prova: o vocabulário sai do ARQUIVO (não de uma lista fixa), código
// não vira cor, arquivo pequeno não ganha vocabulário nenhum, e a cor volta com
// a pontuação original.
//
// Os exemplos vêm da exportação real medida em 26/08/2026.
// Rodar: npx tsx --test src/modules/catalog/domain/corDaDerivacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MINIMO_DE_GRUPOS,
  corDaDerivacao,
  vocabularioDeCores,
  type AmostraDeCor,
} from "./corDaDerivacao.ts";

/** Um arquivo grande o bastante, com PRETO e ROSA repetindo entre produtos. */
function arquivoDeTeste(extra: AmostraDeCor[] = []): AmostraDeCor[] {
  const base: AmostraDeCor[] = [];
  for (let i = 0; i < MINIMO_DE_GRUPOS; i++) {
    base.push({ corECodigo: `${1000 + i} PRETO`, produto: `p${i}` });
    base.push({ corECodigo: `${2000 + i} ROSA/SILVER`, produto: `p${i}` });
  }
  return [...base, ...extra];
}

test("a palavra que repete entre produtos entra; o código não", () => {
  const v = vocabularioDeCores(arquivoDeTeste());
  assert.ok(v.has("PRETO"));
  assert.ok(v.has("ROSA"));
  assert.ok(v.has("SILVER"));
  // "15745" aparece em 62 produtos do arquivo real e é código.
  assert.equal(v.has("1000"), false);
});

test("acento não separa a mesma cor", () => {
  const v = vocabularioDeCores(
    arquivoDeTeste([
      { corECodigo: "77 AVELÃ", produto: "x1" },
      { corECodigo: "88 avela", produto: "x2" },
    ])
  );
  assert.ok(v.has("AVELA"));
  assert.equal(corDaDerivacao("99 AVELÃ T", v), "AVELÃ T");
});

test("inicial de duas letras nunca vira cor", () => {
  const v = vocabularioDeCores(
    arquivoDeTeste([
      { corECodigo: "31 N PRETO", produto: "y1" },
      { corECodigo: "32 N ROSA", produto: "y2" },
    ])
  );
  assert.equal(v.has("N"), false);
  assert.equal(corDaDerivacao("33 N PRETO", v), "PRETO");
});

test("palavra que aparece num produto só fica de fora", () => {
  const v = vocabularioDeCores(arquivoDeTeste([{ corECodigo: "44 ZURI", produto: "z1" }]));
  assert.equal(v.has("ZURI"), false);
});

test("a âncora é a PRIMEIRA palavra de cor, e o resto vem junto", () => {
  // "96782.FX/PRETO 01/CAMEL 1" — o `01` e o `1` são da cor, não do código.
  const v = vocabularioDeCores(arquivoDeTeste([{ corECodigo: "50 CAMEL", produto: "w1" }]));
  assert.equal(corDaDerivacao("96782.FX/PRETO 01/CAMEL 1", v), "PRETO 01/CAMEL 1");
});

test("a cor volta com a pontuação original", () => {
  const v = vocabularioDeCores(arquivoDeTeste());
  assert.equal(corDaDerivacao("9583 ROSA/SILVER", v), "ROSA/SILVER");
});

test("código grudado na cor sem espaço ainda separa", () => {
  const v = vocabularioDeCores(
    arquivoDeTeste([
      { corECodigo: "60 CAMEL", produto: "k1" },
      { corECodigo: "61 CAMEL", produto: "k2" },
    ])
  );
  assert.equal(corDaDerivacao("96781.NP.TAN1080/CAMEL", v), "CAMEL");
});

test("nada reconhecido devolve vazio, e vazio vira pergunta", () => {
  const v = vocabularioDeCores(arquivoDeTeste());
  assert.equal(corDaDerivacao("br204", v), "");
  assert.equal(corDaDerivacao("", v), "");
});

test("arquivo pequeno não ganha vocabulário — coincidência não é sinal", () => {
  const v = vocabularioDeCores([
    { corECodigo: "1 PRETO", produto: "a" },
    { corECodigo: "2 PRETO", produto: "b" },
  ]);
  assert.equal(v.size, 0);
  assert.equal(corDaDerivacao("3 PRETO", v), "");
});

test("o mesmo grupo repetido não infla a contagem", () => {
  // Uma cor com 40 numerações mandaria 40 linhas iguais. Se elas contassem,
  // qualquer arquivo passaria do mínimo com um produto só.
  const repetido: AmostraDeCor[] = [];
  for (let i = 0; i < 40; i++) repetido.push({ corECodigo: "1 PRETO", produto: "unico" });
  assert.equal(vocabularioDeCores(repetido).size, 0);
});

test("duas chamadas seguidas dão o mesmo resultado", () => {
  // Guarda contra o regex /g compartilhado: com `lastIndex` preso, a segunda
  // chamada pularia o começo da string e devolveria outra cor.
  const v = vocabularioDeCores(arquivoDeTeste());
  assert.equal(corDaDerivacao("9583 ROSA/SILVER", v), corDaDerivacao("9583 ROSA/SILVER", v));
});
