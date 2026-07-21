// Linha de base da R12 — Montagem do payload no formato do canal (parte 2 de 2).
// Cobre `montarItensUserProducts`. Puro, sem rede/ML.
// Rodar: node --test src/lib/marketplaces/mlUserProducts.test.ts
//
// Estes testes registram o comportamento ATUAL, não o desejado. Não dependem
// de R13 (`montarBundleUserProducts`): as opções são construídas aqui.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  montarItensUserProducts,
  EMPTY_GTIN_REASON_ID,
  type OpcoesUserProducts,
  type VariacaoUP,
} from "./mlUserProducts.ts";

function variacao(over: Partial<VariacaoUP> = {}): VariacaoUP {
  return { tamanho: "38", estoque: 10, preco: 59.9, ...over };
}

function opcoes(over: Partial<OpcoesUserProducts> = {}): OpcoesUserProducts {
  return {
    familyName: "Chinelo Slim Feminino",
    categoryId: "MLB273770",
    tipoAnuncio: "Premium",
    brand: "Havaianas",
    model: "Slim",
    descricao: "Descrição do anúncio.",
    generoId: "339665",
    gridId: "6199691",
    rowIdPorTamanho: { "38": "6199691:3" },
    variacoes: [variacao()],
    ...over,
  };
}

function attrs(item: Record<string, unknown>): Record<string, string>[] {
  return item.attributes as Record<string, string>[];
}

function attr(item: Record<string, unknown>, id: string): Record<string, string> | undefined {
  return attrs(item).find((a) => a.id === id);
}

// ---- forma do item ----

test("montarItensUserProducts: um item por variação, mesmo family_name e NUNCA title", () => {
  const itens = montarItensUserProducts(
    opcoes({ variacoes: [variacao({ tamanho: "38" }), variacao({ tamanho: "39" })] })
  );
  assert.equal(itens.length, 2);
  assert.equal(itens[0].family_name, "Chinelo Slim Feminino");
  assert.equal(itens[1].family_name, "Chinelo Slim Feminino");
  // Invariante central do modelo User Products: o ML rejeita `title` aqui.
  assert.equal(itens[0].title, undefined);
  assert.equal(itens[1].title, undefined);
});

test("montarItensUserProducts: campos fixos do canal e delegação de listing_type_id", () => {
  const [item] = montarItensUserProducts(
    opcoes({ tipoAnuncio: "Clássico", pictures: ["https://x/a.jpg", "https://x/b.jpg"] })
  );
  assert.equal(item.category_id, "MLB273770");
  assert.equal(item.currency_id, "BRL");
  assert.equal(item.buying_mode, "buy_it_now");
  assert.equal(item.condition, "new");
  assert.equal(item.listing_type_id, "gold_special"); // vem de listingTypeId (mlPayload)
  assert.deepEqual(item.shipping, { mode: "me2", local_pick_up: false, free_shipping: true });
  assert.deepEqual(item.sale_terms, [
    { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
    { id: "WARRANTY_TIME", value_name: "90 dias" },
  ]);
  assert.deepEqual(item.pictures, [{ source: "https://x/a.jpg" }, { source: "https://x/b.jpg" }]);
  assert.deepEqual(item.description, { plain_text: "Descrição do anúncio." });
});

test("montarItensUserProducts: preço por variação e estoque arredondado, nunca negativo", () => {
  const itens = montarItensUserProducts(
    opcoes({
      variacoes: [
        variacao({ tamanho: "38", preco: 79.9, estoque: 2.6 }),
        variacao({ tamanho: "39", preco: 49.9, estoque: -5 }),
      ],
    })
  );
  assert.equal(itens[0].price, 79.9);
  assert.equal(itens[0].available_quantity, 3);
  assert.equal(itens[1].price, 49.9);
  assert.equal(itens[1].available_quantity, 0); // piso em zero
});

// ---- atributos ----

test("montarItensUserProducts: BRAND, MODEL e GENDER sempre; FOOTWEAR_TYPE só se informado", () => {
  const [sem] = montarItensUserProducts(opcoes());
  assert.deepEqual(attr(sem, "BRAND"), { id: "BRAND", value_name: "Havaianas" });
  assert.deepEqual(attr(sem, "MODEL"), { id: "MODEL", value_name: "Slim" });
  assert.deepEqual(attr(sem, "GENDER"), { id: "GENDER", value_id: "339665" });
  assert.equal(attr(sem, "FOOTWEAR_TYPE"), undefined);

  const [com] = montarItensUserProducts(opcoes({ footwearTypeId: "517585" }));
  assert.deepEqual(attr(com, "FOOTWEAR_TYPE"), { id: "FOOTWEAR_TYPE", value_id: "517585" });
});

test("montarItensUserProducts: COLOR prefere corId (value_id) sobre cor (value_name)", () => {
  const [porId] = montarItensUserProducts(
    opcoes({ variacoes: [variacao({ cor: "Preto", corId: "52049" })] })
  );
  assert.deepEqual(attr(porId, "COLOR"), { id: "COLOR", value_id: "52049" });

  const [porNome] = montarItensUserProducts(opcoes({ variacoes: [variacao({ cor: "Preto" })] }));
  assert.deepEqual(attr(porNome, "COLOR"), { id: "COLOR", value_name: "Preto" });

  const [semCor] = montarItensUserProducts(opcoes({ variacoes: [variacao()] }));
  assert.equal(attr(semCor, "COLOR"), undefined);
});

test("montarItensUserProducts: SIZE e SIZE_GRID_ID sempre; SIZE_GRID_ROW_ID só se houver linha", () => {
  const itens = montarItensUserProducts(
    opcoes({
      rowIdPorTamanho: { "38": "6199691:3" },
      variacoes: [variacao({ tamanho: "38" }), variacao({ tamanho: "44" })],
    })
  );
  assert.deepEqual(attr(itens[0], "SIZE"), { id: "SIZE", value_name: "38" });
  assert.deepEqual(attr(itens[0], "SIZE_GRID_ID"), { id: "SIZE_GRID_ID", value_name: "6199691" });
  assert.deepEqual(attr(itens[0], "SIZE_GRID_ROW_ID"), {
    id: "SIZE_GRID_ROW_ID",
    value_name: "6199691:3",
  });
  // Tamanho fora da guia: item ainda é montado, mas sem a linha da grade.
  assert.deepEqual(attr(itens[1], "SIZE_GRID_ID"), { id: "SIZE_GRID_ID", value_name: "6199691" });
  assert.equal(attr(itens[1], "SIZE_GRID_ROW_ID"), undefined);
});

test("montarItensUserProducts: GTIN quando há EAN; senão EMPTY_GTIN_REASON com a constante", () => {
  const [comEan] = montarItensUserProducts(
    opcoes({ variacoes: [variacao({ ean: "  7891234567895  " })] })
  );
  assert.deepEqual(attr(comEan, "GTIN"), { id: "GTIN", value_name: "7891234567895" }); // aparado
  assert.equal(attr(comEan, "EMPTY_GTIN_REASON"), undefined);

  const [semEan] = montarItensUserProducts(opcoes({ variacoes: [variacao({ ean: "   " })] }));
  assert.deepEqual(attr(semEan, "EMPTY_GTIN_REASON"), {
    id: "EMPTY_GTIN_REASON",
    value_id: EMPTY_GTIN_REASON_ID,
  });
  assert.equal(attr(semEan, "GTIN"), undefined);
});

test("montarItensUserProducts: SKU vira SELLER_SKU e seller_custom_field; ausente não cria campo", () => {
  const [com] = montarItensUserProducts(opcoes({ variacoes: [variacao({ sku: "CHN-38-PT" })] }));
  assert.deepEqual(attr(com, "SELLER_SKU"), { id: "SELLER_SKU", value_name: "CHN-38-PT" });
  assert.equal(com.seller_custom_field, "CHN-38-PT");

  const [sem] = montarItensUserProducts(opcoes());
  assert.equal(attr(sem, "SELLER_SKU"), undefined);
  assert.equal(sem.seller_custom_field, undefined);
});
