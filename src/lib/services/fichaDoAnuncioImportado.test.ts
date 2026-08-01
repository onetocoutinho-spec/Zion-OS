// A ficha do lojista para de morrer no caminho.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// `buscarAnunciosDoVendedor` PEDE `attributes` ao ML no multiget. `mapearItem`
// extraía só os ids que conhecia — BRAND, MODEL, COLOR, SIZE, GTIN, SELLER_SKU,
// PACKAGE_* — e `AnuncioML` não tinha campo para a lista inteira. Depois, o
// importador montava a ficha de um par escrito no código:
//
//     const ficha = [{ atributo: "Marca", ... }, { atributo: "Modelo", ... }]
//
// Material da sola, palmilha, tipo de salto, gênero e tipo de calçado chegavam
// do Mercado Livre e eram descartados antes de virar linha.
//
// Medido em 2026-08-01: 500 dos 501 anúncios importados ficaram com DOIS
// atributos. O 501º tem 17 — e se chama "Teste Chinelo Modare", publicado pelo
// próprio Zion.
//
// ===========================================================================
// O QUE ESTE ARQUIVO PROVA — E O QUE NÃO PROVA
// ===========================================================================
//
// PROVA: o que o ML devolve atravessa o mapeador inteiro, e a ficha do anúncio
// importado passa a ser feita dele.
//
// NÃO PROVA que os anúncios reais da lojista TÊM esses atributos preenchidos no
// Mercado Livre. Isso só se sabe reimportando. `GET /items/{id}` deixou de ser
// público (403 PolicyAgent), então nem de fora dá para conferir.

import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { buscarAnunciosDoVendedor } from "../marketplaces/mercadolivre.ts";
import { anuncioGeradoDoML } from "./importarAnunciosML.ts";

const fetchOriginal = globalThis.fetch;

/** Um item como o ML responde: os obrigatórios, e a ficha rica junto. */
const ITEM = {
  id: "MLB123",
  title: "Papete Slide Modare Nobuck",
  category_id: "MLB273770",
  price: 137.94,
  available_quantity: 30,
  status: "active",
  permalink: "https://x/MLB123",
  seller_custom_field: "00956135",
  attributes: [
    { id: "BRAND", name: "Marca", value_name: "Modare" },
    { id: "MODEL", name: "Modelo", value_name: "7208.101" },
    { id: "GENDER", name: "Gênero", value_name: "Feminino" },
    { id: "FOOTWEAR_TYPE", name: "Tipo de calçado", value_name: "Papete" },
    { id: "OUTSOLE_MATERIAL", name: "Material da sola", value_name: "Borracha" },
    { id: "SHOE_INSOLE_TYPE", name: "Tipo de palmilha", value_name: "Anatômica" },
    { id: "HEEL_TYPE", name: "Tipo de salto", value_name: "Sem salto" },
    { id: "COLOR", name: "Cor", value_name: "Nude" },
    { id: "SIZE", name: "Tamanho", value_name: "35" },
    { id: "GTIN", name: "GTIN", value_name: "7900245505007" },
    { id: "PACKAGE_WEIGHT", name: "Peso da embalagem", value_name: "560 g" },
    // Campo que o ML conhece e o anúncio não respondeu.
    { id: "SEASON", name: "Temporada", value_name: null },
  ],
  pictures: [{ secure_url: "https://x/1.jpg" }],
  variations: [],
};

beforeEach(() => {
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    const corpo = url.includes("/items/search")
      ? { results: ["MLB123"], paging: { total: 1 } }
      : [{ code: 200, body: ITEM }];
    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = fetchOriginal;
});

// ---------------------------------------------------------------------------
// O MAPEADOR — nada mais é escolhido na origem
// ---------------------------------------------------------------------------

test("todos os atributos preenchidos atravessam o mapeador", async () => {
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  const ids = a.atributos.map((x) => x.id);
  for (const esperado of [
    "BRAND",
    "MODEL",
    "GENDER",
    "FOOTWEAR_TYPE",
    "OUTSOLE_MATERIAL",
    "SHOE_INSOLE_TYPE",
    "HEEL_TYPE",
  ]) {
    assert.ok(ids.includes(esperado), `${esperado} foi descartado no mapeamento`);
  }
});

test("o mapeador NÃO filtra por importância — a lista é fiel", async () => {
  // Identidade e medidas continuam na lista bruta. Quem quiser filtrar filtra
  // ao exibir; descartar na origem foi o defeito.
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  const ids = a.atributos.map((x) => x.id);
  for (const id of ["COLOR", "SIZE", "GTIN", "PACKAGE_WEIGHT"]) {
    assert.ok(ids.includes(id), `${id} sumiu da lista bruta`);
  }
});

test("atributo sem valor NÃO entra — campo em branco não é informação", async () => {
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  assert.ok(!a.atributos.some((x) => x.id === "SEASON"));
  assert.ok(a.atributos.every((x) => x.valor.length > 0));
});

test("guarda id E nome — um sobrevive a rótulo novo, o outro é o que se lê", async () => {
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  const sola = a.atributos.find((x) => x.id === "OUTSOLE_MATERIAL");
  assert.equal(sola?.nome, "Material da sola");
  assert.equal(sola?.valor, "Borracha");
});

test("os campos antigos continuam funcionando — nada foi trocado, só somado", async () => {
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  assert.equal(a.marca, "Modare");
  assert.equal(a.modelo, "7208.101");
  assert.equal(a.cor, "Nude");
  assert.equal(a.ean, "7900245505007");
  assert.equal(a.sku, "00956135");
});

// ---------------------------------------------------------------------------
// A FICHA — deixa de ser um par escrito no código
// ---------------------------------------------------------------------------

test("a ficha traz o que o lojista informou ao ML, não dois campos fixos", async () => {
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  const ficha = anuncioGeradoDoML(a).fichaTecnica;
  const nomes = ficha.map((f) => f.atributo);
  assert.ok(ficha.length > 2, `a ficha voltou a ter ${ficha.length} linhas`);
  for (const n of ["Material da sola", "Tipo de palmilha", "Tipo de salto", "Gênero"]) {
    assert.ok(nomes.includes(n), `"${n}" não chegou à ficha`);
  }
});

test("identidade NÃO entra na ficha — ela mora na grade, e uma fonte só", async () => {
  // Repetir SKU, EAN, cor e tamanho aqui seria oferecer uma segunda fonte para
  // a identidade. Foi assim que a IA passou a inventá-la (PR #79).
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  const nomes = anuncioGeradoDoML(a).fichaTecnica.map((f) => f.atributo);
  for (const proibido of ["Cor", "Tamanho", "GTIN"]) {
    assert.ok(!nomes.includes(proibido), `${proibido} entrou na ficha`);
  }
});

test("medida de embalagem também fica fora — já vira peso e dimensão", async () => {
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  const nomes = anuncioGeradoDoML(a).fichaTecnica.map((f) => f.atributo);
  assert.ok(!nomes.includes("Peso da embalagem"), "o peso apareceria duas vezes, em unidades diferentes");
});

test("Marca e Modelo continuam na ficha — agora vindos do ML", async () => {
  // Antes eram as duas ÚNICAS, e escritas aqui. Continuam, e pelo mesmo caminho
  // de todas as outras.
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  const ficha = anuncioGeradoDoML(a).fichaTecnica;
  assert.deepEqual(
    ficha.find((f) => f.atributo === "Marca"),
    { atributo: "Marca", valor: "Modare" }
  );
  assert.ok(ficha.some((f) => f.atributo === "Modelo" && f.valor === "7208.101"));
});

test("anúncio sem atributo nenhum devolve ficha vazia, não linha inventada", async () => {
  const vazio = { ...ITEM, attributes: [] };
  globalThis.fetch = (async (entrada: unknown) => {
    const url = typeof entrada === "string" ? entrada : String((entrada as { url?: string })?.url);
    const corpo = url.includes("/items/search")
      ? { results: ["MLB123"], paging: { total: 1 } }
      : [{ code: 200, body: vazio }];
    return new Response(JSON.stringify(corpo), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  const [a] = await buscarAnunciosDoVendedor("tok", "123");
  assert.deepEqual(anuncioGeradoDoML(a).fichaTecnica, []);
});
