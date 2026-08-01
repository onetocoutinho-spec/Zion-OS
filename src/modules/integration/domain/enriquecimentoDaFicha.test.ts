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
  ehDeFicha,
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

// ---------------------------------------------------------------------------
// O RECORTE VEM DO ML — a correção dos 260 falsos conflitos
// ---------------------------------------------------------------------------
//
// A primeira versão excluía uma lista de nomes que EU conhecia. Resultado real:
// 260 "conflitos" que não eram conflito — `SELLER_PACKAGE_*` (peso e medidas da
// embalagem, que variam por tamanho) e `SIZE_GRID_ROW_ID` (a linha da guia, que
// é diferente por definição em cada tamanho).
//
// O ML já responde isso: `hidden` e `variation_attribute`, por categoria.

const CAT = "MLB273770";
const anuncioEm = (
  mlb: string,
  categoria: string,
  atributos: { id: string; nome: string; valor: string }[]
): AnuncioML => ({ mlb, categoria, atributos }) as unknown as AnuncioML;

test("atributo que o ML marca como oculto NÃO vira ficha nem conflito", () => {
  const fora = { [CAT]: ["SELLER_PACKAGE_WEIGHT", "SIZE_GRID_ROW_ID"] };
  const plano = planejarEnriquecimento(
    [
      anuncioEm("MLB1", CAT, [
        { id: "SELLER_PACKAGE_WEIGHT", nome: "Peso da embalagem do vendor", valor: "500 g" },
        { id: "SIZE_GRID_ROW_ID", nome: "ID da linha da guia", valor: "linha-1" },
        { id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" },
      ]),
      anuncioEm("MLB2", CAT, [
        { id: "SELLER_PACKAGE_WEIGHT", nome: "Peso da embalagem do vendor", valor: "620 g" },
        { id: "SIZE_GRID_ROW_ID", nome: "ID da linha da guia", valor: "linha-2" },
        { id: "OUTSOLE_MATERIAL", nome: "Material da sola", valor: "Borracha" },
      ]),
    ],
    new Map([
      ["MLB1", P1],
      ["MLB2", P1],
    ]),
    fora
  );
  // Os dois ocultos DISCORDAM entre si — e mesmo assim não viram conflito.
  assert.deepEqual(plano.conflitos, [], "atributo oculto voltou a virar conflito");
  assert.deepEqual(plano.paraGravar, [
    { produtoId: P1, nomeAtributo: "Material da sola", valorAtributo: "Borracha" },
  ]);
});

test("o recorte é POR CATEGORIA — o mesmo id pode ser ficha noutra", () => {
  // É por isso que `ehDeFicha` devolve uma função, e não um Set.
  const fora = { "MLB-A": ["HEEL_TYPE"] };
  const daFicha = ehDeFicha(fora);
  assert.equal(daFicha("MLB-A", "HEEL_TYPE"), false);
  assert.equal(daFicha("MLB-B", "HEEL_TYPE"), true, "o recorte vazou de uma categoria para outra");
});

test("categoria sem resposta do ML deixa TUDO passar — falha aberta", () => {
  // Esconder sem saber seria afirmar o que não se sabe. O preço de errar para o
  // lado aberto é ruído; para o outro lado, é dado que some da ficha.
  const daFicha = ehDeFicha({});
  assert.equal(daFicha("MLB-DESCONHECIDA", "OUTSOLE_MATERIAL"), true);
  assert.equal(daFicha("MLB-DESCONHECIDA", "QUALQUER_COISA"), true);
});

test("o recorte NOSSO vale mesmo sem o ML — identidade nunca é ficha", () => {
  // Sem tags nenhuma, `SELLER_SKU` e companhia continuam fora: o motivo é
  // nosso (a identidade mora na grade), não do marketplace.
  const daFicha = ehDeFicha({});
  for (const id of ["SELLER_SKU", "GTIN", "COLOR", "SIZE", "SIZE_GRID_ID"]) {
    assert.equal(daFicha(CAT, id), false, `${id} virou ficha`);
  }
});
