// Modelo "User Products" do Mercado Livre (Preço por Variação) — PURO.
//
// Categorias de moda/calçado modernas (ex.: MLB273770 Sandálias e Chinelos)
// NÃO aceitam o payload clássico `title` + `variations[]` — o ML rejeita com
// `body.invalid_fields`. Nesse modelo:
//   - usa-se `family_name` no lugar de `title`;
//   - CADA tamanho é um ITEM separado (price/available_quantity na raiz),
//     todos com o mesmo `family_name` (o ML agrupa como 1 anúncio);
//   - cada item exige SIZE_GRID_ID + SIZE_GRID_ROW_ID (guia de tamanhos criada
//     antes via POST /catalog/charts — ver mercadolivre.ts).
//
// IDs reais confirmados no diário de publicação da Chinelaria (MLB273770).
// A guia (gridId/rowIds) é criada em runtime pelo servidor e injetada aqui.

import { listingTypeId } from "./mlPayload.ts";

// ---- Value-ids reais (categoria MLB273770 / domain SANDALS_AND_CLOGS) ----


/** "O produto não tem código cadastrado" — usar quando faltar EAN. */
export const EMPTY_GTIN_REASON_ID = "17055160";

// ---- Builder ----

export interface VariacaoUP {
  tamanho: string;
  cor?: string;
  /** value_id do COLOR (lista fechada); se ausente, manda value_name. */
  corId?: string;
  sku?: string;
  ean?: string;
  estoque: number;
  preco: number;
}

export interface OpcoesUserProducts {
  /** Vai no lugar do title; o MESMO valor agrupa os itens numa família. */
  familyName: string;
  categoryId: string;
  tipoAnuncio: string;
  brand: string;
  model: string;
  descricao: string;
  /** GENDER value_id (ver GENERO_ID). */
  generoId: string;
  /** FOOTWEAR_TYPE value_id (ver FOOTWEAR_TYPE_ID). */
  footwearTypeId?: string;
  /** SIZE_GRID_ID da guia criada no ML. */
  gridId: string;
  /** tamanho → SIZE_GRID_ROW_ID (ex.: "34" → "6199691:1"). */
  rowIdPorTamanho: Record<string, string>;
  pictures?: string[];
  variacoes: VariacaoUP[];
}

/**
 * Monta os itens User Products — UM por tamanho, todos com o mesmo family_name.
 * O chamador publica cada item (POST /items) e o ML agrupa pela família.
 */
export function montarItensUserProducts(o: OpcoesUserProducts): Record<string, unknown>[] {
  const pictures = (o.pictures ?? []).map((source) => ({ source }));

  return o.variacoes.map((v) => {
    const attributes: Record<string, string>[] = [
      { id: "BRAND", value_name: o.brand },
      { id: "MODEL", value_name: o.model },
      { id: "GENDER", value_id: o.generoId },
    ];
    if (o.footwearTypeId) attributes.push({ id: "FOOTWEAR_TYPE", value_id: o.footwearTypeId });
    if (v.corId) attributes.push({ id: "COLOR", value_id: v.corId });
    else if (v.cor) attributes.push({ id: "COLOR", value_name: v.cor });

    attributes.push({ id: "SIZE", value_name: String(v.tamanho) });
    attributes.push({ id: "SIZE_GRID_ID", value_name: o.gridId });
    const rowId = o.rowIdPorTamanho[String(v.tamanho)];
    if (rowId) attributes.push({ id: "SIZE_GRID_ROW_ID", value_name: rowId });

    if (v.ean && v.ean.trim()) attributes.push({ id: "GTIN", value_name: v.ean.trim() });
    else attributes.push({ id: "EMPTY_GTIN_REASON", value_id: EMPTY_GTIN_REASON_ID });

    if (v.sku) attributes.push({ id: "SELLER_SKU", value_name: v.sku });

    const item: Record<string, unknown> = {
      family_name: o.familyName, // NUNCA enviar `title` neste modelo
      category_id: o.categoryId,
      price: v.preco,
      currency_id: "BRL",
      available_quantity: Math.max(0, Math.round(v.estoque)),
      buying_mode: "buy_it_now",
      listing_type_id: listingTypeId(o.tipoAnuncio),
      condition: "new",
      shipping: { mode: "me2", local_pick_up: false, free_shipping: true },
      sale_terms: [
        { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
        { id: "WARRANTY_TIME", value_name: "90 dias" },
      ],
      pictures,
      attributes,
      description: { plain_text: o.descricao },
    };
    if (v.sku) item.seller_custom_field = v.sku;
    return item;
  });
}

