// Testes das fontes de importação.
//
// O que se prova: a lista descreve o que a LOJISTA tem, cada opção diz o que
// exige antes de pedir o arquivo, e o que não é importação continua de fora.
// Rodar: npx tsx --test src/modules/catalog/domain/fontesDeImportacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FONTES_DE_IMPORTACAO,
  fontePorId,
  fontesQueCriam,
} from "./fontesDeImportacao.ts";

test("toda fonte tem id único", () => {
  const ids = FONTES_DE_IMPORTACAO.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("toda fonte tem título e frase — nenhuma depende de tooltip", () => {
  // A frase é o que substituiu o `title=` que só aparecia com o mouse parado
  // em cima. Uma opção sem frase seria a volta do defeito.
  for (const f of FONTES_DE_IMPORTACAO) {
    assert.ok(f.titulo.trim(), `${f.id} sem título`);
    assert.ok(f.frase.trim().length > 20, `${f.id} sem frase que explique`);
  }
});

test("toda fonte de ARQUIVO diz o que exige ANTES de abrir o seletor", () => {
  // Descobrir que faltava uma coluna depois de escolher o arquivo é a forma
  // cara de aprender: o erro só aparece quando já se investiu a escolha.
  for (const f of FONTES_DE_IMPORTACAO.filter((x) => x.formato === "arquivo")) {
    assert.ok(f.exige.trim(), `${f.id} não diz o que o arquivo precisa ter`);
  }
});

test("conexão não pede arquivo — e por isso não exige coluna nenhuma", () => {
  const ml = fontePorId("ml");
  assert.ok(ml);
  assert.equal(ml.formato, "conexao");
  assert.equal(ml.exige, "");
});

test("FRETE não é fonte de importação", () => {
  // Ele consulta o ML e preenche um campo — não traz produto e não lê arquivo.
  // Estava no meio dos importadores só por vizinhança visual no cabeçalho.
  // Este teste guarda a ausência: pôr `frete` na lista reprova aqui.
  assert.equal(fontePorId("frete"), null);
  assert.ok(!FONTES_DE_IMPORTACAO.some((f) => /frete/i.test(f.id)));
});

test("as que CRIAM produto vêm antes das que só completam", () => {
  // Quem está com a base vazia precisa das primeiras. Oferecer "só os custos"
  // no topo a quem não tem produto nenhum é oferecer uma porta que não abre.
  const criam = FONTES_DE_IMPORTACAO.map((f) => f.cria);
  const primeiroFalso = criam.indexOf(false);
  assert.ok(primeiroFalso > 0, "alguma fonte precisa criar produto");
  assert.ok(
    !criam.slice(primeiroFalso).some(Boolean),
    "depois da primeira que só completa, nenhuma pode voltar a criar"
  );
});

test("fontesQueCriam traz as três portas de quem está começando", () => {
  assert.deepEqual(
    fontesQueCriam().map((f) => f.id),
    ["catalogo", "planilha", "ml"]
  );
});

test("id desconhecido devolve null — nunca a primeira da lista", () => {
  // Cair na primeira faria um clique perdido virar "importar catálogo em PDF".
  assert.equal(fontePorId(""), null);
  assert.equal(fontePorId("planilhas"), null);
});
