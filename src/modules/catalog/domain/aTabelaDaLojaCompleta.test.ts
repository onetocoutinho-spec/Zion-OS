// A tabela de medidas da lojista chega até a publicação.
//
// ===========================================================================
// O QUE FOI MEDIDO EM 28/08/2026
// ===========================================================================
//
// Depois que o cadastro passou a responder pelo gênero, o bundle User Products
// montava 641 dos 674 publicáveis de calçado. Os 33 que sobraram: 3 sem gênero
// em lugar nenhum, e 30 por TAMANHO FORA DA FAIXA da tabela embutida.
//
//     Molekinho  19 a 24   a tabela embutida começa em 25/26  (bebê)
//     Ipanema    25 e 26   começa em 33/34                    (infantil)
//     Yvate      41 a 43   termina em 40
//     Beira Rio  41        termina em 40
//     Modare     33        começa em 34
//
// Essas medidas não estão no software e não é para estarem: centímetro de
// calçado é o que a compradora usa para decidir o pé. Inventar aqui é a mesma
// falta que `medidaDoTamanho` recusa quando escolhe entre 35 e 36.
//
// O que faltava era a resposta DELA chegar. A lojista tem editor em
// `/cliente/medidas` e 14 tabelas gravadas, e `medidasDaMarca` lia só a lista
// embutida: ela editava, salvava, e a publicação não mudava.
//
// Medido depois, com as faltantes simuladas em memória: 641 → 671.
//
// Rodar: npx tsx --test src/modules/catalog/domain/aTabelaDaLojaCompleta.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { medidasDaMarca, medidaDoTamanho } from "./tabelasMedidas.ts";

const MOLEKINHO_BEBE = {
  marca: "Molekinho",
  linhas: [
    { rotulo: "19", valor: "11,7 cm" },
    { rotulo: "20", valor: "12,3 cm" },
  ],
};

test("sem tabela da loja, nada muda — a embutida continua valendo", () => {
  const antes = medidasDaMarca("Molekinho");
  const depois = medidasDaMarca("Molekinho", []);
  assert.deepEqual(depois, antes);
});

test("a tabela dela ACRESCENTA o tamanho que a embutida não cobre", () => {
  // São 30 anúncios desta base exatamente aqui.
  assert.equal(medidaDoTamanho(medidasDaMarca("Molekinho"), "19"), undefined);
  const comADela = medidasDaMarca("Molekinho", [MOLEKINHO_BEBE]);
  assert.equal(medidaDoTamanho(comADela, "19"), 11.7);
});

test("COMPLETA, não substitui — o que ela não repetiu continua publicável", () => {
  // Substituir apagaria os tamanhos que ela não listou na tabela dela, e sumir
  // com tamanho publicável não é o que alguém quer ao editar uma tabela.
  const embutida = medidasDaMarca("Molekinho");
  const comADela = medidasDaMarca("Molekinho", [MOLEKINHO_BEBE]);
  for (const [tamanho, cm] of Object.entries(embutida)) {
    assert.equal(comADela[tamanho], cm, `sumiu o tamanho ${tamanho}`);
  }
});

test("ela CORRIGE o que discorda — a dela vence no mesmo rótulo", () => {
  const embutida = medidasDaMarca("Modare");
  assert.ok(embutida["38"] !== undefined);
  const corrigida = medidasDaMarca("Modare", [
    { marca: "Modare", linhas: [{ rotulo: "38", valor: "25,5 cm" }] },
  ]);
  assert.equal(corrigida["38"], 25.5);
  assert.notEqual(corrigida["38"], embutida["38"]);
});

test("tabela de OUTRA marca não interfere", () => {
  const comOutra = medidasDaMarca("Modare", [MOLEKINHO_BEBE]);
  assert.deepEqual(comOutra, medidasDaMarca("Modare"));
});

test("marca escrita diferente ainda casa — 'BEIRA RIO' e 'Beira Rio'", () => {
  const r = medidasDaMarca("Beira Rio", [
    { marca: "BEIRA RIO", linhas: [{ rotulo: "41", valor: "27,2 cm" }] },
  ]);
  assert.equal(medidaDoTamanho(r, "41"), 27.2);
});

test("VALOR SEM NÚMERO É IGNORADO, e não vira zero", () => {
  // Zero seria um pé de 0 cm publicado no anúncio — pior que a recusa.
  const r = medidasDaMarca("Molekinho", [
    { marca: "Molekinho", linhas: [{ rotulo: "19", valor: "—" }, { rotulo: "20", valor: "" }] },
  ]);
  assert.equal(medidaDoTamanho(r, "19"), undefined);
  assert.equal(medidaDoTamanho(r, "20"), undefined);
});

test("rótulo ilegível é ignorado, e o resto da tabela dela continua valendo", () => {
  const r = medidasDaMarca("Molekinho", [
    {
      marca: "Molekinho",
      linhas: [
        { rotulo: "único", valor: "20,0 cm" },
        { rotulo: "19", valor: "11,7 cm" },
      ],
    },
  ]);
  assert.equal(medidaDoTamanho(r, "19"), 11.7);
});

test("o par dela também entra, na forma canônica", () => {
  const r = medidasDaMarca("Molekinho", [
    { marca: "Molekinho", linhas: [{ rotulo: "19-20", valor: "12,0 cm" }] },
  ]);
  // `normalizarTamanho` canoniza "19-20" em "19/20", e `medidaDoTamanho` lê o
  // número DENTRO do par — a mesma assimetria do DES-004.
  assert.equal(r["19/20"], 12);
  assert.equal(medidaDoTamanho(r, "19"), 12);
});

test("marca desconhecida com tabela dela: a dela vale sobre a referência BR", () => {
  const r = medidasDaMarca("Marca Que Nunca Existiu", [
    { marca: "Marca Que Nunca Existiu", linhas: [{ rotulo: "37", valor: "24,9 cm" }] },
  ]);
  assert.equal(medidaDoTamanho(r, "37"), 24.9);
});
