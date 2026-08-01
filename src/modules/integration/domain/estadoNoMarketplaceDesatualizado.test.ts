// A atualização do estado no marketplace: o que ela escreve e o que ela recusa.
//
// A migração 050 deu um lugar para a verdade e não a preencheu — as 511 linhas
// já importadas ficaram `null`. Mas nós sabemos: a importação lê os 781
// anúncios da conta e usa só os que faltam. O estado dos outros 502 chega na
// mesma resposta e era descartado.

import test from "node:test";
import assert from "node:assert/strict";
import { estadosDesatualizados } from "./estadoNoMarketplaceDesatualizado.ts";

const AGORA = "2026-08-01T19:30:00.000Z";

test("linha sem estado conhecido recebe o que o ML disse", () => {
  // O caso das 502: `null` significa "não sabemos", e agora sabemos.
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: null }],
    [{ mlb: "MLB1", status: "paused" }],
    AGORA
  );
  assert.deepEqual(r, [{ id: "a1", statusMarketplace: "paused", statusMarketplaceEm: AGORA }]);
});

test("estado que NÃO mudou não vira escrita", () => {
  // Regravar `active` por cima de `active` faria `status_marketplace_em` mentir
  // sobre quando aprendemos — e seriam 500 escritas sem fato novo.
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "active" }],
    [{ mlb: "MLB1", status: "active" }],
    AGORA
  );
  assert.deepEqual(r, []);
});

test("estado que mudou vira escrita — inclusive de bom para ruim", () => {
  const r = estadosDesatualizados(
    [
      { id: "a1", mlItemId: "MLB1", statusMarketplace: "active" },
      { id: "a2", mlItemId: "MLB2", statusMarketplace: "paused" },
    ],
    [
      { mlb: "MLB1", status: "closed" },
      { mlb: "MLB2", status: "active" },
    ],
    AGORA
  );
  assert.deepEqual(
    r.map((x) => [x.id, x.statusMarketplace]),
    [
      ["a1", "closed"],
      ["a2", "active"],
    ]
  );
});

test("anúncio que o ML não devolveu fica INTOCADO — ausência não é encerramento", () => {
  // Os 11 MLBs que o Zion tem e a leitura de 781 não trouxe. Marcar como
  // `closed` seria inventar um fato a partir de um silêncio.
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB_SUMIU", statusMarketplace: "active" }],
    [{ mlb: "MLB1", status: "active" }],
    AGORA
  );
  assert.deepEqual(r, []);
});

test("anúncio sem MLB é ignorado — nunca foi ao ar", () => {
  const r = estadosDesatualizados(
    [
      { id: "a1", mlItemId: null, statusMarketplace: null },
      { id: "a2", mlItemId: "   ", statusMarketplace: null },
    ],
    [{ mlb: "MLB1", status: "active" }],
    AGORA
  );
  assert.deepEqual(r, []);
});

test("estado em branco vindo do ML NÃO apaga o que sabíamos", () => {
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "active" }],
    [{ mlb: "MLB1", status: "" }],
    AGORA
  );
  assert.deepEqual(r, [], "sobrescrever com 'não sabemos' perde informação");
});

test("o mesmo instante vale para o lote inteiro — é o que permite agrupar", () => {
  // `atualizarVarios` agrupa por payload idêntico. Um timestamp por linha
  // faria 502 requisições em vez de uma por estado distinto.
  const r = estadosDesatualizados(
    [
      { id: "a1", mlItemId: "MLB1" },
      { id: "a2", mlItemId: "MLB2" },
      { id: "a3", mlItemId: "MLB3" },
    ],
    [
      { mlb: "MLB1", status: "paused" },
      { mlb: "MLB2", status: "paused" },
      { mlb: "MLB3", status: "active" },
    ],
    AGORA
  );
  assert.equal(new Set(r.map((x) => x.statusMarketplaceEm)).size, 1);
  assert.equal(new Set(r.map((x) => x.statusMarketplace)).size, 2, "dois payloads distintos");
});

test("o eixo da esteira não aparece na saída — esta função não toca em `status`", () => {
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1" }],
    [{ mlb: "MLB1", status: "closed" }],
    AGORA
  );
  assert.deepEqual(Object.keys(r[0]).sort(), ["id", "statusMarketplace", "statusMarketplaceEm"]);
});

test("listas vazias não produzem escrita", () => {
  assert.deepEqual(estadosDesatualizados([], [], AGORA), []);
  assert.deepEqual(estadosDesatualizados([{ id: "a1", mlItemId: "MLB1" }], [], AGORA), []);
});
