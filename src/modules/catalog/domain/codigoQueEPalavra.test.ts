// Palavra no lugar do código — o recado que o ERP manda e o importador lê errado.
//
// MEDIDO em 27/08/2026 no catálogo real: 1003 produtos, e 22 com isto no SKU e
// no Código do ERP, os dois campos iguais:
//
//     inativoo  iinnattivo  inatt  inativo7  inativ  inativado  innattivoo
//     iinativoo  inattivvo  iiinativo  INAATIVO  iinnativo  inativoooo
//     INATIVVO  iinnaattivo  iinativo  inaattivo  inatiivo  inativos
//     inativva  inattivoo  innativo  ·  e um "PRESENTE"
//
// Ninguém digita isso 22 vezes por acidente. É alguém marcando "produto fora de
// linha" no campo do código, com uma letra a mais a cada vez porque o ERP não
// aceita dois códigos iguais. A grafia errada é o contorno da restrição.
//
// O estrago medido: os 22 viraram produto normal, entraram na contagem do
// catálogo e na lista de "faltam fotos", e 19 RECEBERAM foto.
//
// Rodar: npx tsx --test src/modules/catalog/domain/codigoQueEPalavra.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import {
  avisoDeCodigoQueEPalavra,
  ehPalavraNoLugarDoCodigo,
  type LinhaComCodigo,
} from "./codigoQueEPalavra.ts";

const linha = (p: Partial<LinhaComCodigo> = {}): LinhaComCodigo => ({
  nome: "Tênis Molekinho 2638.103 Duplo Velcro",
  sku: "2638103",
  codErp: "2638103",
  ...p,
});

test("código de verdade tem dígito — nenhum deles é palavra", () => {
  // Os formatos que este catálogo usa de fato. Se algum virar "palavra", o
  // aviso passa a gritar em importação boa e ninguém o lê mais.
  for (const c of ["7208.101", "MF9184", "2588100", "010.012", "1319.1000", "BLC-9931", "22591.408"]) {
    assert.equal(ehPalavraNoLugarDoCodigo(c), false, `"${c}" foi lido como palavra`);
  }
});

test("as 22 grafias medidas são todas reconhecidas", () => {
  // A regra NÃO tenta reconhecer a palavra "inativo" — reconhecer palavras seria
  // perseguir grafias para sempre. Ela olha a ausência de dígito, e é por isso
  // que pega as 22 de uma vez, e o "PRESENTE" junto.
  const medidas = [
    "inativoo", "iinnattivo", "inatt", "inativ", "inativado", "innattivoo",
    "iinativoo", "inattivvo", "iiinativo", "INAATIVO", "iinnativo", "inativoooo",
    "INATIVVO", "iinnaattivo", "iinativo", "inaattivo", "inatiivo", "inativos",
    "inativva", "inattivoo", "innativo", "PRESENTE",
  ];
  for (const p of medidas) {
    assert.equal(ehPalavraNoLugarDoCodigo(p), true, `"${p}" passou como código`);
  }
});

test('"inativo7" tem dígito e NÃO é pego — e isso está certo', () => {
  // Uma das 22 grafias reais leva um número no fim. A regra a deixa passar, e a
  // alternativa seria caçar a palavra — o caminho que não termina.
  //
  // Fica escrito aqui para ninguém "consertar" isso depois sem saber o custo:
  // pegar "inativo7" exige reconhecer a PALAVRA, e aí "Kit 3" e "Duo 2" entram
  // junto. Uma linha a menos no aviso é mais barata que um aviso que grita à toa.
  assert.equal(ehPalavraNoLugarDoCodigo("inativo7"), false);
});

test("catálogo limpo não gera aviso — o silêncio é a resposta comum", () => {
  assert.equal(avisoDeCodigoQueEPalavra([linha(), linha({ sku: "010.012" })]), null);
});

test("o aviso conta as linhas e mostra as palavras encontradas", () => {
  const a = avisoDeCodigoQueEPalavra([
    linha(),
    linha({ nome: "Chinelos Havaianas Slim Visuals", sku: "iinnattivo", codErp: "iinnattivo" }),
    linha({ nome: "Mocassim Modare 7397.101 Floather", sku: "inatt", codErp: "inatt" }),
  ]);
  assert.ok(a);
  assert.equal(a.linhas, 2);
  assert.deepEqual(a.palavras.sort(), ["iinnattivo", "inatt"]);
  assert.equal(a.exemplos.length, 2);
});

test("a frase diz a CONSEQUÊNCIA, não o fato", () => {
  // "22 SKUs inválidos" não move ninguém. O que move é saber que eles vão pedir
  // foto e preço, e chegar perto da publicação.
  const a = avisoDeCodigoQueEPalavra([linha({ sku: "inativoo", codErp: "inativoo" })]);
  assert.ok(a);
  assert.match(a.texto, /entram como produto normal/);
  assert.match(a.texto, /pedem foto e preço/);
  assert.match(a.texto, /publicação/);
  assert.match(a.texto, /"inativoo"/);
});

test("basta UM dos dois campos ser palavra", () => {
  // Nos 22 medidos os dois vinham iguais. Um ERP que preencha só um produz o
  // mesmo estrago, e o aviso precisa pegar os dois casos.
  assert.ok(avisoDeCodigoQueEPalavra([linha({ sku: "2638103", codErp: "inativo" })]));
  assert.ok(avisoDeCodigoQueEPalavra([linha({ sku: "inativo", codErp: "2638103" })]));
});

test("uma letra só não é palavra — coluna com lixo de uma letra não vira alarme", () => {
  assert.equal(ehPalavraNoLugarDoCodigo("x"), false);
  assert.equal(ehPalavraNoLugarDoCodigo(""), false);
  assert.equal(ehPalavraNoLugarDoCodigo(undefined), false);
});

test("muitas palavras distintas não viram uma frase interminável", () => {
  const muitas = Array.from({ length: 12 }, (_, i) =>
    linha({ nome: `Produto ${i}`, sku: "in" + "a".repeat(i + 1) + "tivo", codErp: "" })
  );
  const a = avisoDeCodigoQueEPalavra(muitas);
  assert.ok(a);
  assert.equal(a.linhas, 12);
  assert.match(a.texto, /entre outras/);
  assert.equal(a.exemplos.length, 3);
});
