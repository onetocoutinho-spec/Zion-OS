// Construtor de payload do Mercado Livre (PURO — sem rede, sem segredo).
//
// Traduz o Anúncio Final da esteira (AnuncioGerado) + os dados do produto no
// corpo do item do ML (POST /items). É o que o dry-run mostra para a equipe
// revisar antes de publicar de verdade.
//
// Guia de atributos: "De-para de Categorias ML — atributos obrigatórios".
// A fonte da verdade dos atributos obrigatórios continua sendo
// GET /categories/{id}/attributes no momento do cadastro.

import type { AnuncioGerado } from "../agentes/esteira";
import type { Produto } from "../types";

/** Premium = mais exposição (gold_pro); Clássico = gold_special. */
export function listingTypeId(tipoAnuncio: string): string {
  return /prem|pro|gold_pro/i.test(tipoAnuncio) ? "gold_pro" : "gold_special";
}

/** fichaTecnica.atributo (pt) → id de atributo do ML (calçados). */
const MAPA_ATRIBUTOS_ML: Record<string, string> = {
  marca: "BRAND",
  modelo: "MODEL",
  genero: "GENDER",
  "genero (masculino/feminino)": "GENDER",
  "tipo de calcado": "FOOTWEAR_TYPE",
  "tipo de calçado": "FOOTWEAR_TYPE",
  "cor principal": "MAIN_COLOR",
  cor: "MAIN_COLOR",
  material: "MATERIAL",
  "material externo": "MATERIAL",
  "tipo de fechamento": "CLOSURE_TYPE",
  fechamento: "CLOSURE_TYPE",
  linha: "LINE",
  "formato da numeracao": "SIZE_GRID_ID",
  "formato da numeração": "SIZE_GRID_ID",
};

function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos
}

function paraNumero(v: string | number | undefined | null): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  let s = String(v).trim().replace(/[^\d,.-]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export interface OpcoesPayloadML {
  /** Só precisamos de preço e estoque do produto pai. */
  produto: Pick<Produto, "precoVenda" | "estoque">;
  anuncio: AnuncioGerado;
  categoryId: string;
  tipoAnuncio: string;
  /** URLs públicas de imagens (o ML não aceita prompts, só URLs/upload). */
  pictures?: string[];
}

/** Monta o corpo do item do ML. Campos que faltam viram valores vazios/seguros. */
export function montarItemML(opcoes: OpcoesPayloadML): Record<string, unknown> {
  const { produto, anuncio, categoryId, tipoAnuncio, pictures = [] } = opcoes;

  // Atributos a partir da ficha técnica (pula pendências "⚠️ informação necessária").
  const attributes = (anuncio.fichaTecnica ?? [])
    .filter((f) => f.valor && !/informação necessária|informacao necessaria/i.test(f.valor))
    .map((f) => {
      const id = MAPA_ATRIBUTOS_ML[normalizar(f.atributo)];
      return id ? { id, value_name: f.valor } : { name: f.atributo, value_name: f.valor };
    });

  // Variações → attribute_combinations (SIZE + COLOR) + estoque/preço por variação.
  const variations = (anuncio.variacoes ?? [])
    .filter((v) => v.tamanho || v.cor)
    .map((v) => {
      const comb: { id: string; value_name: string }[] = [];
      if (v.tamanho) comb.push({ id: "SIZE", value_name: String(v.tamanho) });
      if (v.cor) comb.push({ id: "COLOR", value_name: String(v.cor) });
      const variacao: Record<string, unknown> = {
        attribute_combinations: comb,
        available_quantity: Math.max(0, Math.round(paraNumero(v.estoque))),
        price: paraNumero(v.preco) || produto.precoVenda,
      };
      if (v.sku) variacao.seller_custom_field = v.sku;
      return variacao;
    });

  const temVariacoes = variations.length > 0;
  const precoBase =
    produto.precoVenda ||
    Math.min(...variations.map((v) => Number(v.price)).filter((n) => n > 0), Infinity);

  const item: Record<string, unknown> = {
    title: anuncio.tituloOtimizado.slice(0, 60),
    category_id: categoryId,
    price: Number.isFinite(precoBase) ? precoBase : produto.precoVenda,
    currency_id: "BRL",
    buying_mode: "buy_it_now",
    listing_type_id: listingTypeId(tipoAnuncio),
    condition: "new",
    sale_terms: [
      { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
      { id: "WARRANTY_TIME", value_name: "90 dias" },
    ],
    pictures: pictures.map((source) => ({ source })),
    attributes,
    description: { plain_text: anuncio.descricaoCompleta || anuncio.descricaoCurta || "" },
  };

  if (temVariacoes) {
    item.variations = variations;
  } else {
    item.available_quantity = Math.max(1, produto.estoque || 1);
  }

  return item;
}
