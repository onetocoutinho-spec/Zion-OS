// DES-002 — o plano de enriquecimento, provado sem infraestrutura.
//
// A parte difícil não é escrever: é decidir o que fazer quando dois anúncios do
// MESMO produto discordam. No modelo User Products um produto vira vários MLBs
// (um por tamanho), e eles podem trazer "Material da sola" diferente.
//
// Escolher o mais frequente seria decidir em silêncio sobre dado da lojista —
// e é justamente o que o custo ambíguo já ensinou a não fazer.

import test from "node:test";
import assert from "node:assert/strict";
import {
  planejarEnriquecimento,
  ATRIBUTOS_COM_CASA_PROPRIA,
} from "./enriquecimentoDaFicha.ts";
import type { AnuncioML } from "../../../lib/marketplaces/mercadolivre.ts";

const anuncio = (
  mlb: string,
  atributos: { id: string; nome: string; valor: string }[]
): AnuncioML => ({ mlb, atributos }) as unknown as AnuncioML;

const P1 = "prod-1";
const P2 = "prod-2";

// ---------------------------------------------------------------------------
// O CAMINHO SIMPLES
// ---------------------------------------------------------------------------

test("todos concordam ⇒ grava", () => {
  const plano = planejarEnriquecimento(
    [
      anuncio("MLB1", [{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" }]),
      anuncio("MLB2", [{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" }]),
    ],
    new Map([
      ["MLB1", P1],
      ["MLB2", P1],
    ])
  );
  assert.deepEqual(plano.paraGravar, [
    { produtoId: P1, nomeAtributo: "Material da sola", valorAtributo: "Borracha" },
  ]);
  assert.deepEqual(plano.conflitos, []);
  assert.equal(plano.produtos, 1);
});

// ---------------------------------------------------------------------------
// O CAMINHO QUE IMPORTA
// ---------------------------------------------------------------------------

test("discordaram ⇒ NÃO grava, e vira conflito com os números", () => {
  // O sistema não escolhe. Apresenta, e quem decide é a lojista.
  const plano = planejarEnriquecimento(
    [
      anuncio("MLB1", [{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" }]),
      anuncio("MLB2", [{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "EVA" }]),
      anuncio("MLB3", [{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" }]),
    ],
    new Map([
      ["MLB1", P1],
      ["MLB2", P1],
      ["MLB3", P1],
    ])
  );
  assert.deepEqual(plano.paraGravar, [], "gravou apesar da discordância");
  assert.equal(plano.conflitos.length, 1);
  assert.deepEqual(plano.conflitos[0], {
    produtoId: P1,
    nomeAtributo: "Material da sola",
    valores: [
      { valor: "Borracha", anuncios: 2 },
      { valor: "EVA", anuncios: 1 },
    ],
  });
});

test("o conflito de um atributo não contamina os outros do mesmo produto", () => {
  const plano = planejarEnriquecimento(
    [
      anuncio("MLB1", [
        { id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" },
        { id: "HEEL_TYPE", nome: "Tipo de salto", valor: "Sem salto" },
      ]),
      anuncio("MLB2", [
        { id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "EVA" },
        { id: "HEEL_TYPE", nome: "Tipo de salto", valor: "Sem salto" },
      ]),
    ],
    new Map([
      ["MLB1", P1],
      ["MLB2", P1],
    ])
  );
  assert.deepEqual(plano.paraGravar, [
    { produtoId: P1, nomeAtributo: "Tipo de salto", valorAtributo: "Sem salto" },
  ]);
  assert.equal(plano.conflitos.length, 1);
  assert.equal(plano.conflitos[0].nomeAtributo, "Material da sola");
});

test("produtos diferentes não se misturam", () => {
  // Dois produtos com o MESMO atributo e valores diferentes não é conflito —
  // é a vida normal de um catálogo.
  const plano = planejarEnriquecimento(
    [
      anuncio("MLB1", [{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" }]),
      anuncio("MLB2", [{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "EVA" }]),
    ],
    new Map([
      ["MLB1", P1],
      ["MLB2", P2],
    ])
  );
  assert.deepEqual(plano.conflitos, []);
  assert.equal(plano.paraGravar.length, 2);
  assert.equal(plano.produtos, 2);
});

// ---------------------------------------------------------------------------
// O RECORTE, E O QUE NÃO SOME EM SILÊNCIO
// ---------------------------------------------------------------------------

test("identidade e medida NÃO viram ficha — o mesmo recorte de sempre", () => {
  // Repetir SKU, EAN, cor e tamanho aqui seria oferecer uma SEGUNDA fonte para
  // a identidade, que é como a IA passou a inventá-la (PR #79).
  for (const id of [...ATRIBUTOS_COM_CASA_PROPRIA]) {
    const plano = planejarEnriquecimento(
      [anuncio("MLB1", [{ id, nome: id, valor: "x" }])],
      new Map([["MLB1", P1]])
    );
    assert.deepEqual(plano.paraGravar, [], `${id} virou atributo de produto`);
    assert.equal(plano.produtos, 0);
  }
});

test("anúncio sem produto vinculado é CONTADO, não engolido", () => {
  // "não gravei nada para 40 anúncios" é informação, e some se ninguém contar.
  const plano = planejarEnriquecimento(
    [
      anuncio("MLB1", [{ id: "HEEL_TYPE", nome: "Tipo de salto", valor: "Anabela" }]),
      anuncio("MLB-ORFAO", [{ id: "HEEL_TYPE", nome: "Tipo de salto", valor: "Anabela" }]),
    ],
    new Map([["MLB1", P1]])
  );
  assert.equal(plano.anunciosSemProduto, 1);
  assert.equal(plano.paraGravar.length, 1);
});

test("atributo sem nome cai no id — nunca vira linha sem rótulo", () => {
  const plano = planejarEnriquecimento(
    [anuncio("MLB1", [{ id: "SHOE_INSOLE_TYPE", nome: "", valor: "Anatômica" }])],
    new Map([["MLB1", P1]])
  );
  assert.equal(plano.paraGravar[0].nomeAtributo, "SHOE_INSOLE_TYPE");
});

// ---------------------------------------------------------------------------
// DETERMINISMO — o mesmo insumo, o mesmo plano
// ---------------------------------------------------------------------------

test("a ordem é estável: dois planos do mesmo insumo são idênticos", () => {
  // Sem isso, dois enriquecimentos seguidos gerariam diffs diferentes do MESMO
  // dado, e ninguém saberia dizer se algo mudou.
  const entrada: [readonly AnuncioML[], Map<string, string>] = [
    [
      anuncio("MLB2", [{ id: "HEEL_TYPE", nome: "Tipo de salto", valor: "Anabela" }]),
      anuncio("MLB1", [{ id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" }]),
    ],
    new Map([
      ["MLB1", P2],
      ["MLB2", P1],
    ]),
  ];
  const a = planejarEnriquecimento(...entrada);
  const b = planejarEnriquecimento(...entrada);
  assert.deepEqual(a, b);
  assert.deepEqual(
    a.paraGravar.map((x) => x.produtoId),
    [P1, P2],
    "a ordenação por produto deixou de valer"
  );
});

test("lista vazia devolve plano vazio, não erro", () => {
  assert.deepEqual(planejarEnriquecimento([], new Map()), {
    paraGravar: [],
    conflitos: [],
    produtos: 0,
    anunciosSemProduto: 0,
  });
});
