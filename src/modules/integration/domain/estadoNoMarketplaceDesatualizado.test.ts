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
  // deepEqual da forma INTEIRA: a 051 acrescentou três campos e a 056 um
  // quinto, e eles precisam sair explícitos aqui. Afrouxar para
  // `assert.equal(r[0].id, "a1")` deixaria um campo novo nascer com lixo sem
  // ninguém ver — e foi esta asserção que pegou a `categoriaMl` chegando.
  assert.deepEqual(r, [
    {
      id: "a1",
      statusMarketplace: "paused",
      statusMarketplaceEm: AGORA,
      subStatusMarketplace: [],
      fotoCapaMaxSize: null,
      estoqueMarketplace: null,
      categoriaMl: null,
    },
  ]);
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
  assert.deepEqual(Object.keys(r[0]).sort(), [
    "categoriaMl",
    "estoqueMarketplace",
    "fotoCapaMaxSize",
    "id",
    "statusMarketplace",
    "statusMarketplaceEm",
    "subStatusMarketplace",
  ]);
});

test("listas vazias não produzem escrita", () => {
  assert.deepEqual(estadosDesatualizados([], [], AGORA), []);
  assert.deepEqual(estadosDesatualizados([{ id: "a1", mlItemId: "MLB1" }], [], AGORA), []);
});

// ---------------------------------------------------------------------------
// OS QUATRO FATOS DA LEITURA (migração 051)
// ---------------------------------------------------------------------------

test("mudança SÓ no sub_status já é motivo de escrita", () => {
  // Antes da 051 o `sub_status` era medido e descartado — foi ele que revelou
  // 6 infrações de propriedade intelectual que ninguém sabia existirem. Se só
  // o estado fosse comparado, um anúncio que passasse a `forbidden` sem mudar
  // de `under_review` não seria gravado.
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "under_review", subStatusMarketplace: [] }],
    [{ mlb: "MLB1", status: "under_review", subStatus: ["forbidden"] }],
    AGORA
  );
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].subStatusMarketplace, ["forbidden"]);
});

test("mudança só na CAPA ou só no ESTOQUE também escreve", () => {
  const base = { id: "a1", mlItemId: "MLB1", statusMarketplace: "active" };
  const capa = estadosDesatualizados(
    [{ ...base, fotoCapaMaxSize: "800x800" }],
    [{ mlb: "MLB1", status: "active", fotoCapaMaxSize: "1200x1200" }],
    AGORA
  );
  assert.equal(capa[0]?.fotoCapaMaxSize, "1200x1200");

  const estoque = estadosDesatualizados(
    [{ ...base, estoqueMarketplace: 10 }],
    [{ mlb: "MLB1", status: "active", estoque: 7 }],
    AGORA
  );
  assert.equal(estoque[0]?.estoqueMarketplace, 7);
});

test("os quatro iguais NÃO viram escrita", () => {
  const r = estadosDesatualizados(
    [
      {
        id: "a1",
        mlItemId: "MLB1",
        statusMarketplace: "active",
        subStatusMarketplace: ["out_of_stock"],
        fotoCapaMaxSize: "1200x1200",
        estoqueMarketplace: 5,
      },
    ],
    [
      {
        mlb: "MLB1",
        status: "active",
        subStatus: ["out_of_stock"],
        fotoCapaMaxSize: "1200x1200",
        estoque: 5,
      },
    ],
    AGORA
  );
  assert.deepEqual(r, [], "regravar sem fato novo faria a data mentir");
});

test("a ordem do sub_status não conta como mudança", () => {
  // `["a","b"]` e `["b","a"]` são o mesmo fato. Sem ordenar, toda leitura
  // reescreveria a linha e `status_marketplace_em` mentiria sobre quando
  // aprendemos.
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "x", subStatusMarketplace: ["b", "a"] }],
    [{ mlb: "MLB1", status: "x", subStatus: ["a", "b"] }],
    AGORA
  );
  assert.deepEqual(r, []);
});

test("estoque ZERO é fato; ausente é silêncio", () => {
  const zero = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "x", estoqueMarketplace: 5 }],
    [{ mlb: "MLB1", status: "x", estoque: 0 }],
    AGORA
  );
  assert.equal(zero[0]?.estoqueMarketplace, 0);

  const ausente = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "x", estoqueMarketplace: null }],
    [{ mlb: "MLB1", status: "x" }],
    AGORA
  );
  assert.deepEqual(ausente, [], "campo não lido não pode virar escrita");
});

// ---------------------------------------------------------------------------
// A CATEGORIA — o quinto fato (056)
// ---------------------------------------------------------------------------
//
// Medido em 10/08/2026: sem `category_id`, `/sites/MLB/listing_prices` devolve
// null e a precificação inteira cai na tabela. A tabela cobra 19% em tudo; as
// bolsas dela são MLB7022, onde o ML cobra 15% — quatro pontos de comissão
// inventada, que fazem a margem parecer pior e o preço ideal sair mais alto.

test("mudança só na CATEGORIA já é motivo de escrita", () => {
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "active", categoriaMl: "MLB273770" }],
    [{ mlb: "MLB1", status: "active", categoriaMl: "MLB7022" }],
    AGORA
  );
  assert.equal(r.length, 1, "a categoria mudou e ninguém gravou");
  assert.equal(r[0].categoriaMl, "MLB7022");
});

test("categoria em branco NÃO apaga a que sabíamos", () => {
  // Mesma regra do `status` em branco: o ML não disse, e sobrescrever com
  // "não sabemos" perde informação. Aqui perderia a tarifa exata.
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "active", categoriaMl: "MLB7022" }],
    [{ mlb: "MLB1", status: "paused" }],
    AGORA
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].categoriaMl, "MLB7022", "a categoria conhecida foi apagada por uma leitura que não a trouxe");
});

test("a mesma categoria não vira escrita", () => {
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "active", categoriaMl: "MLB7022" }],
    [{ mlb: "MLB1", status: "active", categoriaMl: "MLB7022" }],
    AGORA
  );
  assert.deepEqual(r, []);
});
