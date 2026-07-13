// Testes dos mapeadores raw → canônico — puros.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  identidadeDe,
  paraCategoriaLida,
  paraImagemLida,
  paraProdutoCanonico,
  paraVarianteCanonica,
} from "./mapeadores.ts";
import type { ProdutoMagazordRaw } from "./tipos-magazord.ts";

const PRODUTO: ProdutoMagazordRaw = {
  id: 1,
  codigo: "MZ-001",
  skuFornecedor: "FORN-9",
  ean: "7891234567895",
  nome: "Fone TWS",
  marca: "TechSound",
  modelo: "TS-200",
  descricao: "Fone bluetooth",
  categoria: { id: 10, nome: "Fones", caminho: "Áudio > Fones", paiId: 5 },
  variacoes: [{ id: 2, codigo: "MZ-001-P", cor: "Preto", tamanho: "U" }],
  imagens: [{ url: "http://img/1.jpg", principal: true }],
};

test("identidadeDe: usa SKU de fornecedor como sku_origem; erp_sku = código", () => {
  const i = identidadeDe("MZ-001", "FORN-9", "7891234567895");
  assert.equal(i.skuOrigem, "FORN-9");
  assert.equal(i.erpSku, "MZ-001");
  assert.equal(i.ean, "7891234567895");
});

test("identidadeDe: sem SKU de fornecedor → sku_origem cai para o código", () => {
  const i = identidadeDe("MZ-001", null, null);
  assert.equal(i.skuOrigem, "MZ-001");
  assert.equal(i.ean, null);
});

test("paraProdutoCanonico: mapeia conteúdo e categoria (caminho)", () => {
  const p = paraProdutoCanonico(PRODUTO);
  assert.equal(p.nome, "Fone TWS");
  assert.equal(p.marca, "TechSound");
  assert.equal(p.categoriaZion, "Áudio > Fones");
  assert.equal(p.identidade.skuOrigem, "FORN-9");
  assert.equal(p.variantes.length, 1);
  assert.equal(p.variantes[0].cor, "Preto");
});

test("paraVarianteCanonica: NÃO carrega estoque/custo/preço (read-only de catálogo)", () => {
  const v = paraVarianteCanonica({ id: 2, codigo: "MZ-001-P", cor: "Preto", tamanho: "U" });
  assert.equal(v.precoVenda, undefined);
  assert.equal(v.estoqueErp, undefined);
  assert.equal(v.custoErp, undefined);
  assert.equal(v.identidade.erpSku, "MZ-001-P");
});

test("paraImagemLida: defaults de ordem/principal por índice", () => {
  const primeira = paraImagemLida({ url: "a" }, 0);
  assert.equal(primeira.ordem, 0);
  assert.equal(primeira.principal, true);
  const segunda = paraImagemLida({ url: "b" }, 1);
  assert.equal(segunda.principal, false);
});

test("paraCategoriaLida: id/paiId viram string; caminho normalizado", () => {
  const c = paraCategoriaLida({ id: 10, nome: "Fones", caminho: "Áudio > Fones", paiId: 5 });
  assert.equal(c.id, "10");
  assert.equal(c.paiId, "5");
  assert.equal(c.caminho, "Áudio > Fones");
});
