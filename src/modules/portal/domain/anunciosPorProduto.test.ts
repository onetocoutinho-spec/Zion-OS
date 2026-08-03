// 880 linhas viram ~80, e passa a ter busca.
//
// 03/08/2026, na tela "Meus Anúncios":
//
//   "fui pesquisar o item aqui e não tem uma barra de pesquisa, e porque não
//    aparece somente o 'anúncio pai' e as derivações dentro mas todas as
//    derivações separadas"
//
// No modelo User Products do ML cada TAMANHO é um MLB próprio, e a importação
// grava um anúncio por MLB de propósito — é assim que o ERP casa SKU com
// anúncio. Mas a lojista pensa em "Babuche Molekinha 2591.103", um produto com
// vários tamanhos, que é como o painel do próprio ML mostra.

import test from "node:test";
import assert from "node:assert/strict";
import { agruparAnunciosPorProduto, filtrarPorTexto } from "./anunciosPorProduto.ts";

const a = (id: string, p: Record<string, unknown> = {}) => ({
  id,
  produtoId: "prd-1",
  produto: "Babuche Molekinha 2591.103",
  mlItemId: `MLB${id}`,
  statusMarketplace: "active",
  criadoEm: "2026-08-01T10:00:00.000Z",
  ...p,
});

// ---------------------------------------------------------------------------
// O AGRUPAMENTO
// ---------------------------------------------------------------------------

test("tamanhos do mesmo produto viram UM grupo", () => {
  const g = agruparAnunciosPorProduto([a("1"), a("2"), a("3")]);
  assert.equal(g.length, 1);
  assert.equal(g[0].anuncios.length, 3);
  assert.equal(g[0].nome, "Babuche Molekinha 2591.103");
});

test("produtos diferentes ficam separados", () => {
  const g = agruparAnunciosPorProduto([
    a("1"),
    a("2", { produtoId: "prd-2", produto: "Chinelo Havaianas Top" }),
  ]);
  assert.equal(g.length, 2);
});

test("anúncio SEM produto vira grupo próprio, não um monte 'sem produto'", () => {
  // Juntar todos os órfãos num grupo só esconderia que são coisas diferentes,
  // e ela não teria como abrir um deles.
  const g = agruparAnunciosPorProduto([
    a("1", { produtoId: null, produto: null }),
    a("2", { produtoId: null, produto: null }),
  ]);
  assert.equal(g.length, 2);
  assert.notEqual(g[0].chave, g[1].chave);
});

test("sem produto, o nome cai para o título do anúncio", () => {
  const g = agruparAnunciosPorProduto([
    a("1", { produtoId: null, produto: null, anuncio: { tituloOtimizado: "Papete Modare Nobuck" } }),
  ]);
  assert.equal(g[0].nome, "Papete Modare Nobuck");
});

test("sem produto e sem título, o nome DIZ que falta vínculo", () => {
  const g = agruparAnunciosPorProduto([a("1", { produtoId: null, produto: null, anuncio: null })]);
  assert.match(g[0].nome, /sem produto/i);
});

test("a ordem de quem chegou é preservada — quem chamou já ordenou", () => {
  const g = agruparAnunciosPorProduto([
    a("1", { produtoId: "z", produto: "Zaxy" }),
    a("2", { produtoId: "b", produto: "Beira Rio" }),
  ]);
  assert.deepEqual(
    g.map((x) => x.nome),
    ["Zaxy", "Beira Rio"],
    "reordenou por conta própria"
  );
});

// ---------------------------------------------------------------------------
// A CONTA DE ESTADO
// ---------------------------------------------------------------------------

test("o grupo conta no ar, fora do ar e sem estado", () => {
  const g = agruparAnunciosPorProduto([
    a("1", { statusMarketplace: "active" }),
    a("2", { statusMarketplace: "paused" }),
    a("3", { statusMarketplace: "under_review" }),
    a("4", { statusMarketplace: null }),
  ]);
  assert.equal(g[0].noAr, 1);
  assert.equal(g[0].foraDoAr, 2);
  assert.equal(g[0].semEstado, 1);
});

test("anúncio sem MLB NÃO entra na conta — nunca esteve no ar", () => {
  // Um rascunho que nunca foi ao marketplace não está "fora do ar".
  const g = agruparAnunciosPorProduto([
    a("1", { mlItemId: null, statusMarketplace: null }),
    a("2", { statusMarketplace: "active" }),
  ]);
  assert.equal(g[0].anuncios.length, 2, "ele continua NA lista");
  assert.equal(g[0].noAr, 1);
  assert.equal(g[0].foraDoAr, 0);
  assert.equal(g[0].semEstado, 0, "sem MLB não é 'estado desconhecido'");
});

// ---------------------------------------------------------------------------
// A BUSCA
// ---------------------------------------------------------------------------

test("acha pelo nome do produto, sem caixa e sem acento", () => {
  const lista = [a("1"), a("2", { produtoId: "p2", produto: "Sandália Ipanema Glow" })];
  assert.equal(filtrarPorTexto(lista, "MOLEKINHA").length, 1);
  assert.equal(filtrarPorTexto(lista, "sandalia").length, 1, "acento atrapalhou");
});

test("acha pelo MLB colado do painel do ML", () => {
  const lista = [a("1", { mlItemId: "MLB4980127845" }), a("2", { mlItemId: "MLB7048385994" })];
  assert.equal(filtrarPorTexto(lista, "MLB4980127845").length, 1);
});

test("acha pelo código do modelo, que é como ela procura", () => {
  const lista = [a("1"), a("2", { produtoId: "p2", produto: "Chinelo Havaianas Top Liso" })];
  assert.equal(filtrarPorTexto(lista, "2591.103").length, 1);
});

test("acha pelo título quando o produto não diz", () => {
  const lista = [
    a("1", { produto: "", anuncio: { tituloOtimizado: "Papete Slide Modare Nobuck" } }),
    a("2"),
  ];
  assert.equal(filtrarPorTexto(lista, "papete").length, 1);
});

test("termo vazio devolve TUDO — filtro que esconde sem ter sido pedido é silêncio", () => {
  const lista = [a("1"), a("2")];
  assert.equal(filtrarPorTexto(lista, "").length, 2);
  assert.equal(filtrarPorTexto(lista, "   ").length, 2);
});

test("busca sem resultado devolve vazio, não a lista inteira", () => {
  assert.equal(filtrarPorTexto([a("1")], "nao existe isso").length, 0);
});

test("a busca não muta a lista recebida", () => {
  const lista = [a("1"), a("2")];
  filtrarPorTexto(lista, "molekinha");
  assert.equal(lista.length, 2);
});

test("lista vazia não quebra nem inventa grupo", () => {
  assert.deepEqual(agruparAnunciosPorProduto([]), []);
  assert.deepEqual(filtrarPorTexto([], "qualquer"), []);
});
