// Linha de base da R12 — Montagem do payload no formato do canal (parte 1 de 2).
// Cobre `listingTypeId` e `montarItemML`. Puros, sem rede/ML.
// Rodar: node --test src/lib/marketplaces/mlPayload.test.ts
//
// Estes testes registram o comportamento ATUAL, não o desejado. Não dependem
// de R13 (`montarBundleUserProducts`): os insumos são construídos aqui.

import { test } from "node:test";
import assert from "node:assert/strict";
import { listingTypeId, montarItemML } from "./mlPayload.ts";
import type { AnuncioGerado } from "../../../lib/agentes/esteira.ts";

type Ficha = { atributo: string; valor: string; obrigatorio: boolean };
type Var = { cor: string; tamanho: string; sku: string; ean: string; estoque: string; preco: string; obs: string };

function anuncio(over: { ficha?: Ficha[]; variacoes?: Var[]; titulo?: string } = {}): AnuncioGerado {
  return {
    notaDiagnostico: 90,
    tituloOtimizado: over.titulo ?? "Chinelo Slim Feminino Conforto",
    palavrasChavePrincipais: [],
    palavrasChaveSecundarias: [],
    descricaoCompleta: "Descrição completa.",
    descricaoCurta: "Curta.",
    fichaTecnica: over.ficha ?? [],
    tabelaMedidas: "",
    comoMedir: "",
    forma: "normal",
    variacoes: over.variacoes ?? [],
    imagensSugeridas: [],
    faq: [],
    pendencias: [],
    sugestoes: [],
    vereditoA10: "aprovado",
    motivoVeredito: "",
  };
}

function v(over: Partial<Var> = {}): Var {
  return { cor: "", tamanho: "", sku: "", ean: "", estoque: "10", preco: "59,90", obs: "", ...over };
}

const PRODUTO = { precoVenda: 99.9, estoque: 5, sku: "SKU-PAI", codErp: "ERP-1" };

function montar(over: Partial<Parameters<typeof montarItemML>[0]> = {}) {
  return montarItemML({
    produto: PRODUTO,
    anuncio: anuncio(),
    categoryId: "MLB273770",
    tipoAnuncio: "Premium",
    ...over,
  });
}

// ---- listingTypeId ----

test("listingTypeId: só Premium/pro vira gold_pro; o resto é gold_special", () => {
  assert.equal(listingTypeId("Premium"), "gold_pro");
  assert.equal(listingTypeId("PRO"), "gold_pro");
  assert.equal(listingTypeId("gold_pro"), "gold_pro");
  assert.equal(listingTypeId("Clássico"), "gold_special");
  assert.equal(listingTypeId(""), "gold_special");
});

// ---- montarItemML: forma do item ----

test("montarItemML: usa title (nunca family_name) e trunca em 60 caracteres", () => {
  const longo = "C".repeat(80);
  const item = montar({ anuncio: anuncio({ titulo: longo }) });
  assert.equal(typeof item.title, "string");
  assert.equal((item.title as string).length, 60);
  assert.equal(item.family_name, undefined); // invariante: este NÃO é o modelo User Products
});

test("montarItemML: campos fixos do canal e delegação de listing_type_id", () => {
  const item = montar({ tipoAnuncio: "Clássico", pictures: ["https://x/a.jpg"] });
  assert.equal(item.category_id, "MLB273770");
  assert.equal(item.currency_id, "BRL");
  assert.equal(item.buying_mode, "buy_it_now");
  assert.equal(item.condition, "new");
  assert.equal(item.listing_type_id, "gold_special"); // vem de listingTypeId
  assert.deepEqual(item.shipping, { mode: "me2", local_pick_up: false, free_shipping: true });
  assert.deepEqual(item.sale_terms, [
    { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
    { id: "WARRANTY_TIME", value_name: "90 dias" },
  ]);
  assert.deepEqual(item.pictures, [{ source: "https://x/a.jpg" }]);
  assert.deepEqual(item.description, { plain_text: "Descrição completa." });
});

// ---- montarItemML: atributos ----

test("montarItemML: mapeia a ficha técnica por id do ML, normalizando acento e caixa", () => {
  const item = montar({
    anuncio: anuncio({
      ficha: [
        { atributo: "Marca", valor: "Havaianas", obrigatorio: true },
        { atributo: "Tipo de Calçado", valor: "Chinelo", obrigatorio: false },
        { atributo: "Atributo Sem Mapa", valor: "Valor", obrigatorio: false },
      ],
    }),
  });
  const attrs = item.attributes as Record<string, string>[];
  assert.deepEqual(attrs[0], { id: "BRAND", value_name: "Havaianas" });
  assert.deepEqual(attrs[1], { id: "FOOTWEAR_TYPE", value_name: "Chinelo" });
  // Sem mapeamento: vai como nome livre, não como id inventado.
  assert.deepEqual(attrs[2], { name: "Atributo Sem Mapa", value_name: "Valor" });
});

test("montarItemML: descarta pendências e resolve SELLER_SKU com fallback para codErp", () => {
  const comPendencia = montar({
    anuncio: anuncio({
      ficha: [
        { atributo: "Marca", valor: "⚠️ informação necessária", obrigatorio: true },
        { atributo: "Modelo", valor: "Slim", obrigatorio: true },
      ],
    }),
  });
  const attrs = comPendencia.attributes as Record<string, string>[];
  assert.equal(attrs.some((a) => a.id === "BRAND"), false); // pendência não vira atributo
  assert.deepEqual(attrs[0], { id: "MODEL", value_name: "Slim" });
  assert.deepEqual(attrs[1], { id: "SELLER_SKU", value_name: "SKU-PAI" });

  const semSku = montar({ produto: { precoVenda: 10, estoque: 1, codErp: "ERP-9" } });
  const a2 = semSku.attributes as Record<string, string>[];
  assert.ok(a2.some((a) => a.id === "SELLER_SKU" && a.value_name === "ERP-9"));
});

test("montarItemML: EMPTY_GTIN_REASON só quando nenhuma variação tem EAN", () => {
  const sem = montar({ anuncio: anuncio({ variacoes: [v({ tamanho: "38" })] }) });
  const attrsSem = sem.attributes as Record<string, string>[];
  assert.ok(attrsSem.some((a) => a.id === "EMPTY_GTIN_REASON" && a.value_id === "17055160"));

  const com = montar({ anuncio: anuncio({ variacoes: [v({ tamanho: "38", ean: "789123" })] }) });
  const attrsCom = com.attributes as Record<string, string>[];
  assert.equal(attrsCom.some((a) => a.id === "EMPTY_GTIN_REASON"), false);
});

// ---- montarItemML: variações e preço ----

test("montarItemML: variações viram attribute_combinations com número parseado", () => {
  const item = montar({
    anuncio: anuncio({
      variacoes: [
        v({ tamanho: "38", cor: "Preto", sku: "S-38", estoque: "2,6", preco: "1.234,56" }),
        v({ tamanho: "40", estoque: "-5", preco: "0" }), // estoque negativo → piso em zero
        v({ tamanho: "", cor: "", obs: "ignorada" }), // sem tamanho e sem cor → descartada
      ],
    }),
  });
  const vars = item.variations as Record<string, unknown>[];
  assert.equal(vars.length, 2);
  assert.equal(vars[1].available_quantity, 0); // piso em zero, nunca negativo
  assert.equal(vars[1].price, PRODUTO.precoVenda); // preço 0 cai para o do produto
  assert.deepEqual(vars[0].attribute_combinations, [
    { id: "SIZE", value_name: "38" },
    { id: "COLOR", value_name: "Preto" },
  ]);
  assert.equal(vars[0].available_quantity, 3); // 2,6 arredondado
  assert.equal(vars[0].price, 1234.56); // vírgula decimal + separador de milhar
  assert.equal(vars[0].seller_custom_field, "S-38");
  assert.equal(item.available_quantity, undefined); // com variações, não vai na raiz
});

test("montarItemML: sem variações, estoque e SKU vão na raiz; preço cai para o menor da grade", () => {
  const semVar = montar({ produto: { precoVenda: 0, estoque: 0, sku: "SKU-PAI" } });
  assert.equal(semVar.variations, undefined);
  assert.equal(semVar.available_quantity, 1); // piso de 1
  assert.equal(semVar.seller_custom_field, "SKU-PAI");
  assert.equal(semVar.price, 0); // sem variações e sem preço: permanece 0

  const comVar = montar({
    produto: { precoVenda: 0, estoque: 0 },
    anuncio: anuncio({
      variacoes: [v({ tamanho: "38", preco: "80,00" }), v({ tamanho: "39", preco: "49,90" })],
    }),
  });
  assert.equal(comVar.price, 49.9); // menor preço positivo da grade
});
