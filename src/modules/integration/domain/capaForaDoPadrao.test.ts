// A capa contra o padrão do ML — e por que o número vem de `max_size`.
//
// ===========================================================================
// O CASO
// ===========================================================================
//
// Painel da lojista, 02/08/2026, em dezenas de anúncios:
//
//     "Perdendo exposição — A foto de capa não cumpre os requisitos."
//
// ===========================================================================
// A PRIMEIRA ANÁLISE ESTAVA ERRADA
// ===========================================================================
//
// Tentei descobrir o tamanho trocando o sufixo da URL do CDN por `-F`, e
// produzi uma lista de "57 capas fora do padrão" que não valia. Medido no
// mesmo dia, no CDN do ML:
//
//     Papete Modare     -F = 492x245     -B = 800x800    ← -F NÃO é a maior
//     Sapatilha Modare  -F = 185x90      -B = 800x800
//     Havaianas Slim    -F = 1200x1200   -B = 800x800    ← aqui -F é a maior
//
// O sufixo não indica qual variante é a maior. `max_size` é o ML falando, e
// vinha em toda resposta — nós é que descartávamos.

import test from "node:test";
import assert from "node:assert/strict";
import { lerMaxSize, resumirCapas, LADO_MINIMO_DA_CAPA } from "./capaForaDoPadrao.ts";

// ---------------------------------------------------------------------------
// LER O QUE O ML ESCREVE
// ---------------------------------------------------------------------------

test("lê `1200x1200` e reconhece como padrão", () => {
  const c = lerMaxSize("1200x1200");
  assert.deepEqual(c, { largura: 1200, altura: 1200, quadrada: true, grandeOSuficiente: true });
});

test("quadrada mas pequena NÃO passa", () => {
  const c = lerMaxSize("800x800");
  assert.equal(c?.quadrada, true);
  assert.equal(c?.grandeOSuficiente, false);
});

test("grande mas não quadrada NÃO passa", () => {
  const c = lerMaxSize("1600x1200");
  assert.equal(c?.grandeOSuficiente, true);
  assert.equal(c?.quadrada, false);
});

test("o mínimo é 1200 de LADO, não de área", () => {
  // 1500x1000 tem 1,5 milhão de pixels — MAIS que os 1,44 milhões de
  // 1200x1200 — e mesmo assim não serve, porque um lado tem 1000.
  //
  // A primeira versão deste teste usava 2000x600, que tem MENOS área que
  // 1200x1200 e portanto falhava nas duas regras: passava com a implementação
  // por lado E com a por área, sem provar qual estava valendo.
  assert.equal(lerMaxSize("1500x1000")?.grandeOSuficiente, false);
  assert.equal(lerMaxSize("2000x600")?.grandeOSuficiente, false);
  assert.equal(LADO_MINIMO_DA_CAPA, 1200);
});

test("aceita espaço e X maiúsculo — a forma varia", () => {
  assert.equal(lerMaxSize(" 1200 X 1200 ")?.largura, 1200);
});

// ---------------------------------------------------------------------------
// "NÃO SEI" NUNCA VIRA ACUSAÇÃO
// ---------------------------------------------------------------------------

test("sem `max_size` devolve null — acusar por campo ausente é inventar defeito", () => {
  for (const v of [undefined, null, "", "   ", "grande", "1200", "0x0", "x", "1200x"]) {
    assert.equal(lerMaxSize(v), null, `"${v}" virou medida`);
  }
});

test("anúncio sem tamanho fica em `semTamanho`, fora de `foraDoPadrao`", () => {
  const r = resumirCapas([
    { mlb: "A", fotoCapaMaxSize: "1200x1200" },
    { mlb: "B" },
    { mlb: "C", fotoCapaMaxSize: "" },
  ]);
  assert.equal(r.medidas, 1);
  assert.equal(r.semTamanho, 2);
  assert.equal(r.noPadrao, 1);
  assert.equal(r.foraDoPadrao, 0, "acusou anúncio cujo tamanho o ML não informou");
});

// ---------------------------------------------------------------------------
// O RESUMO
// ---------------------------------------------------------------------------

test("separa no padrão de fora do padrão", () => {
  const r = resumirCapas([
    { mlb: "A", fotoCapaMaxSize: "1200x1200" },
    { mlb: "B", fotoCapaMaxSize: "800x800" },
    { mlb: "C", fotoCapaMaxSize: "1600x1200" },
    { mlb: "D", fotoCapaMaxSize: "2000x2000" },
  ]);
  assert.equal(r.noPadrao, 2, "A e D");
  assert.equal(r.foraDoPadrao, 2, "B e C");
});

test("as piores vêm primeiro, pela ÁREA — é onde o estrago é maior", () => {
  const r = resumirCapas([
    { mlb: "GRANDE", fotoCapaMaxSize: "1100x1100" },
    { mlb: "MINUSCULA", fotoCapaMaxSize: "185x90" },
    { mlb: "MEDIA", fotoCapaMaxSize: "800x800" },
  ]);
  assert.deepEqual(
    r.piores.map((c) => c.mlb),
    ["MINUSCULA", "MEDIA", "GRANDE"]
  );
});

test("a medida acompanha o MLB — o número sozinho não diz onde mexer", () => {
  const r = resumirCapas([{ mlb: "MLB123", fotoCapaMaxSize: "800x800" }]);
  assert.deepEqual(r.piores, [{ mlb: "MLB123", tamanho: "800x800" }]);
});

test("empate de área desempata pelo MLB — a ordem é determinística", () => {
  const a = resumirCapas([
    { mlb: "MLB2", fotoCapaMaxSize: "800x800" },
    { mlb: "MLB1", fotoCapaMaxSize: "800x800" },
  ]);
  assert.deepEqual(
    a.piores.map((c) => c.mlb),
    ["MLB1", "MLB2"]
  );
});

test("lista vazia não produz acusação nenhuma", () => {
  assert.deepEqual(resumirCapas([]), {
    medidas: 0,
    semTamanho: 0,
    noPadrao: 0,
    foraDoPadrao: 0,
    piores: [],
  });
});
