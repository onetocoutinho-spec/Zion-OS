// Testes de Listing — puros.
import { test } from "node:test";
import assert from "node:assert/strict";

import { Listing } from "./listing.ts";
import { ListingVariante } from "./listing-variante.ts";
import { podeTransicionarListing } from "./estados-listing.ts";
import { comoId } from "../shared/value-objects/identificador.ts";
import { Dinheiro } from "../shared/value-objects/dinheiro.ts";
import type {
  IdListing,
  IdListingVariante,
  IdProdutoMestre,
  IdVariante,
} from "../shared/value-objects/identificador.ts";

const AGORA = "2026-07-13T00:00:00.000Z";
const LIS_ID = comoId<"listing">("lis-1") as IdListing;

function novoListing(): Listing {
  const r = Listing.criarRascunho({
    id: LIS_ID,
    produtoMestreId: comoId<"produto_mestre">("pm-1") as IdProdutoMestre,
    canal: "mercado_livre",
    canalContaId: "conta-1",
    modeloPublicacao: "user_products",
    agora: AGORA,
  });
  if (!r.ok) throw new Error("listing de teste inválido");
  return r.valor;
}

test("criarRascunho: nasce em rascunho sem marketplaceItemId", () => {
  const l = novoListing();
  assert.equal(l.status, "rascunho");
  assert.equal(l.marketplaceItemId, null);
});

test("marcarPublicado: exige item id e transita para publicado", () => {
  const l = novoListing();
  assert.equal(l.marcarPublicado("", null, AGORA).ok, false); // sem item id
  const r = l.marcarPublicado("MLB123", "http://x", AGORA);
  assert.ok(r.ok);
  assert.equal(l.status, "publicado");
  assert.equal(l.marketplaceItemId, "MLB123");
  assert.equal(l.publicadoEm, AGORA);
});

test("mapearVariante: aceita do próprio listing; rejeita duplicada e de outro listing", () => {
  const l = novoListing();
  const lv = criarLv("lv-1", "var-1", LIS_ID);
  assert.equal(l.mapearVariante(lv).ok, true);

  const dup = criarLv("lv-2", "var-1", LIS_ID); // mesma variante
  const rDup = l.mapearVariante(dup);
  assert.equal(rDup.ok, false);
  if (!rDup.ok) assert.equal(rDup.erro.codigo, "variante_duplicada");

  const outro = criarLv("lv-3", "var-2", comoId<"listing">("outro") as IdListing);
  const rOutro = l.mapearVariante(outro);
  assert.equal(rOutro.ok, false);
  if (!rOutro.ok) assert.equal(rOutro.erro.codigo, "variante_nao_pertence");
});

test("transição inválida barrada (rascunho → ativo direto)", () => {
  const l = novoListing();
  const r = l.ativar(AGORA);
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.erro.codigo, "transicao_invalida");
});

test("máquina: publicado → ativo → pausado → ativo é válido", () => {
  assert.equal(podeTransicionarListing("publicado", "ativo"), true);
  assert.equal(podeTransicionarListing("ativo", "pausado"), true);
  assert.equal(podeTransicionarListing("pausado", "ativo"), true);
  assert.equal(podeTransicionarListing("encerrado", "ativo"), false);
});

test("confirmarEnvio da ListingVariante grava id de variação e status enviado", () => {
  const lv = criarLv("lv-1", "var-1", LIS_ID);
  const preco = Dinheiro.criar(99.9);
  assert.ok(preco.ok);
  if (preco.ok) {
    const r = lv.confirmarEnvio("VAR-ML-9", preco.valor, 10);
    assert.ok(r.ok);
    assert.equal(lv.marketplaceVariationId, "VAR-ML-9");
    assert.equal(lv.statusEnvio, "enviado");
    assert.equal(lv.estoqueEnviado, 10);
  }
});

function criarLv(id: string, varId: string, listingId: IdListing): ListingVariante {
  const r = ListingVariante.criar({
    id: comoId<"listing_variante">(id) as IdListingVariante,
    listingId,
    varianteId: comoId<"variante">(varId) as IdVariante,
  });
  if (!r.ok) throw new Error("listing variante de teste inválida");
  return r.valor;
}
