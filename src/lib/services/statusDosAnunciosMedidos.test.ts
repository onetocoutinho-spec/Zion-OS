// A medição conta o status REAL de cada anúncio no ML.
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Observado em 2026-08-01, depois de tirar o teto de 500: a conta da Chinelaria
// tem **781 anúncios** e o export do ERP lista **561**. A diferença de 220 não
// tem explicação enquanto ninguém souber quantos estão no ar.
//
// E importar sem saber é pior que não importar: o importador grava
// `status: "publicado"` FIXO (importarAnunciosML.ts), e `StatusAnuncioGerado`
// não tem `pausado` nem `encerrado`. Um anúncio morto no ML entraria no Zion
// como publicado — e a guarda contra publicação duplicada passaria a proteger
// um anúncio que não existe mais.
//
// Medir não conserta isso. Medir diz o tamanho do problema antes de escolher.

import test from "node:test";
import assert from "node:assert/strict";
import { medirFichas } from "./importarAnunciosML.ts";
import type { AnuncioML } from "../marketplaces/mercadolivre.ts";

const anuncio = (
  mlb: string,
  status: string,
  subStatus: string[] = [],
  fotoCapaMaxSize = ""
): AnuncioML => ({
  mlb,
  subStatus,
  fotoCapaMaxSize,
  atributos: [],
  titulo: `Anúncio ${mlb}`,
  categoria: "MLB273770",
  preco: 10,
  estoque: 1,
  status,
  permalink: `https://x/${mlb}`,
  sku: "",
  marca: "",
  modelo: "",
  fotos: [],
  variacoes: [],
  familyId: "",
  familyName: "",
  cor: "",
  tamanho: "",
  ean: "",
  pesoGramas: 0,
  alturaCm: 0,
  larguraCm: 0,
  comprimentoCm: 0,
});

test("conta cada status, do mais comum para o menos", () => {
  const m = medirFichas([
    anuncio("A", "active"),
    anuncio("B", "closed"),
    anuncio("C", "active"),
    anuncio("D", "paused"),
    anuncio("E", "active"),
  ]);
  assert.deepEqual(m.porStatus, [
    { status: "active", anuncios: 3 },
    { status: "closed", anuncios: 1 },
    { status: "paused", anuncios: 1 },
  ]);
});

test("status em branco NÃO vira `active` — o ML não disse", () => {
  // Inventar aqui é o mesmo defeito que fez o Copilot preencher campo sem
  // fonte. Ausência tem que continuar significando ausência.
  const m = medirFichas([anuncio("A", ""), anuncio("B", "   ")]);
  assert.deepEqual(m.porStatus, [{ status: "(não informado)", anuncios: 2 }]);
});

test("os NOVOS são contados por status, separados do total", () => {
  // Este é o número que decide: importar 268 anúncios dos quais 200 estão
  // encerrados é diferente de importar 268 no ar.
  const m = medirFichas(
    [
      anuncio("A", "active"),
      anuncio("B", "closed"),
      anuncio("C", "closed"),
      anuncio("D", "active"),
    ],
    {},
    new Set(["A", "B"])
  );
  assert.deepEqual(m.porStatus, [
    { status: "active", anuncios: 2 },
    { status: "closed", anuncios: 2 },
  ]);
  assert.deepEqual(m.novosPorStatus, [
    { status: "active", anuncios: 1 },
    { status: "closed", anuncios: 1 },
  ]);
});

test("sem conhecidos, TODOS são novos — o padrão não esconde nada", () => {
  const m = medirFichas([anuncio("A", "active"), anuncio("B", "closed")]);
  assert.equal(
    m.novosPorStatus.reduce((n, s) => n + s.anuncios, 0),
    2
  );
});

test("Zion já tem todos: a lista de novos fica vazia, não some", () => {
  const m = medirFichas([anuncio("A", "active")], {}, new Set(["A"]));
  assert.deepEqual(m.novosPorStatus, []);
  assert.deepEqual(m.porStatus, [{ status: "active", anuncios: 1 }]);
});

test("a medição continua não gravando nada — a contagem é pura", () => {
  // `medirFichas` não recebe repositório, cliente nem escrita. Se um dia
  // receber, este teste não compila.
  const antes = [anuncio("A", "active")];
  const m = medirFichas(antes, {}, new Set());
  assert.equal(m.anuncios, 1);
  assert.equal(antes.length, 1, "a entrada foi mutada");
});

// ---------------------------------------------------------------------------
// POR QUE NÃO ESTÁ NO AR — o campo que a API sempre teve e nós não pedíamos
// ---------------------------------------------------------------------------

test("o motivo do ML é contado, e um anúncio com dois motivos conta os dois", () => {
  const m = medirFichas([
    anuncio("A", "under_review", ["pending_documentation"]),
    anuncio("B", "under_review", ["pending_documentation", "waiting_for_patch"]),
  ]);
  assert.deepEqual(m.motivosDeNaoEstarNoAr, [
    { motivo: "pending_documentation", anuncios: 2, exemplos: ["A", "B"], completo: true },
    { motivo: "waiting_for_patch", anuncios: 1, exemplos: ["B"], completo: true },
  ]);
});

test("anúncio ATIVO não entra na conta de motivos", () => {
  // Um `active` com sub_status residual não é "fora do ar".
  const m = medirFichas([anuncio("A", "active", ["deleted"]), anuncio("B", "paused")]);
  assert.equal(m.motivosDeNaoEstarNoAr.some((x) => x.motivo === "deleted"), false);
});

test("sem motivo informado, a resposta é que o ML NÃO disse — não silêncio", () => {
  // "155 em revisão" sem motivo é o problema original. Se o ML também não
  // explicar, isso precisa aparecer como fato, não como lista vazia.
  const m = medirFichas([anuncio("A", "under_review", [])]);
  assert.equal(m.motivosDeNaoEstarNoAr.length, 1);
  assert.match(m.motivosDeNaoEstarNoAr[0].motivo, /não informou/i);
});

test("conta só de ativos não produz motivo nenhum", () => {
  const m = medirFichas([anuncio("A", "active"), anuncio("B", "active")]);
  assert.deepEqual(m.motivosDeNaoEstarNoAr, []);
});

test("anúncio vindo de um servidor SEM o campo novo não derruba a medição", () => {
  // Defasagem de deploy é real: em 2026-08-01 uma aba aberta rodou o pacote
  // antigo e a importação inteira saiu sem gravar estado. Campo novo que
  // atravessa a fronteira JSON pode chegar ausente.
  const velho = { ...anuncio("A", "under_review") } as Partial<AnuncioML>;
  delete velho.subStatus;
  const m = medirFichas([velho as AnuncioML]);
  assert.equal(m.anuncios, 1);
  assert.match(m.motivosDeNaoEstarNoAr[0].motivo, /não informou/i);
});

// ---------------------------------------------------------------------------
// QUAIS ANÚNCIOS — o número sozinho não dá o que fazer
// ---------------------------------------------------------------------------

test("balde pequeno lista TODOS e se declara completo", () => {
  // "7 forbidden" diz que existe problema. Os MLBs dizem onde.
  const m = medirFichas([
    anuncio("MLB1", "under_review", ["forbidden"]),
    anuncio("MLB2", "under_review", ["forbidden"]),
  ]);
  const b = m.motivosDeNaoEstarNoAr[0];
  assert.deepEqual(b.exemplos, ["MLB1", "MLB2"]);
  assert.equal(b.completo, true);
});

test("balde grande vira AMOSTRA e se declara incompleto", () => {
  // Sem essa distinção, 10 de 150 se lê como "são só esses dez".
  const muitos = Array.from({ length: 25 }, (_, i) =>
    anuncio(`MLB${i}`, "under_review", ["waiting_for_patch"])
  );
  const b = medirFichas(muitos).motivosDeNaoEstarNoAr[0];
  assert.equal(b.anuncios, 25);
  assert.equal(b.exemplos.length, 10, "listou mais que o teto");
  assert.equal(b.completo, false);
});

test("o MLB entra em CADA motivo dele, não só no primeiro", () => {
  const m = medirFichas([anuncio("MLB1", "under_review", ["forbidden", "out_of_stock"])]);
  for (const b of m.motivosDeNaoEstarNoAr) {
    assert.deepEqual(b.exemplos, ["MLB1"], `${b.motivo} perdeu o MLB`);
  }
});

test("anúncio ATIVO não aparece em exemplo nenhum", () => {
  const m = medirFichas([
    anuncio("ATIVO", "active", ["deleted"]),
    anuncio("FORA", "paused", ["deleted"]),
  ]);
  const b = m.motivosDeNaoEstarNoAr.find((x) => x.motivo === "deleted");
  assert.deepEqual(b?.exemplos, ["FORA"]);
});
