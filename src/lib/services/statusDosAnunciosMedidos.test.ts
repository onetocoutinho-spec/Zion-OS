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

const anuncio = (mlb: string, status: string): AnuncioML => ({
  mlb,
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
