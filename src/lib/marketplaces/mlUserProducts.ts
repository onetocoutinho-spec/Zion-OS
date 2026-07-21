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
import type { AnuncioGerado } from "../agentes/esteira";
import type { LinhaGuiaTamanho } from "./mercadolivre";
import { normalizarTamanho } from "../../modules/publication/domain/normalizarTamanho.ts";
import { medidasDaMarca } from "../../modules/catalog/domain/tabelasMedidas.ts";

// ---- Value-ids reais (categoria MLB273770 / domain SANDALS_AND_CLOGS) ----

export const GENERO_ID = {
  feminino: "339665",
  masculino: "339666",
  meninas: "339668",
  meninos: "339667",
  sem_genero_infantil: "19159491",
  sem_genero: "110461",
} as const;

export const FOOTWEAR_TYPE_ID = {
  sandalia: "517585",
  chinelo: "517586",
  tamanco: "3630523",
  mule: "3630524",
} as const;

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

// ---- Montagem do bundle a partir do Anúncio Final (PURO) ----
//
// O navegador tem os dados crus (ficha, variações, marca) mas NÃO o token do
// ML; o servidor tem o token mas NÃO os dados crus. Então o navegador monta
// este bundle (puro, testável) e o servidor cria a guia + publica um item por
// tamanho. Falha FECHADA: dado obrigatório ausente vira erro, nunca palpite.

/** Ingredientes do User Products enviados ao servidor (sem gridId/rowIds). */
export interface BundleUserProducts {
  familyName: string;
  tipoAnuncio: string;
  brand: string;
  model: string;
  descricao: string;
  generoId: string;
  generoNome: string;
  footwearTypeId?: string;
  pictures: string[];
  /** numeração → cm, para POST /catalog/charts. */
  guiaLinhas: LinhaGuiaTamanho[];
  /** uma por (tamanho, cor), tamanho já normalizado. */
  variacoes: VariacaoUP[];
}

export type ResultadoBundle =
  | { ok: true; bundle: BundleUserProducts }
  | { ok: false; motivo: string };

function semAcento(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
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

/** Valor da ficha técnica por atributo (ignora pendências "informação necessária"). */
function fichaValor(anuncio: AnuncioGerado, aliases: string[]): string {
  const alvo = aliases.map(semAcento);
  for (const f of anuncio.fichaTecnica ?? []) {
    if (!alvo.includes(semAcento(f.atributo))) continue;
    const v = (f.valor ?? "").trim();
    if (!v || /informacao necessaria/.test(semAcento(v))) continue;
    return v;
  }
  return "";
}

/** Gênero (texto pt) → value_id do ML + nome canônico. Null se não reconhecido. */
function generoParaId(valor: string): { id: string; nome: string } | null {
  const s = semAcento(valor);
  if (!s) return null;
  if (/menina/.test(s)) return { id: GENERO_ID.meninas, nome: "Meninas" };
  if (/menino/.test(s)) return { id: GENERO_ID.meninos, nome: "Meninos" };
  if (/(feminino|mulher|\bfem\b)/.test(s)) return { id: GENERO_ID.feminino, nome: "Feminino" };
  if (/(masculino|homem|\bmasc\b)/.test(s)) return { id: GENERO_ID.masculino, nome: "Masculino" };
  if (/infantil/.test(s)) return { id: GENERO_ID.sem_genero_infantil, nome: "Sem gênero" };
  if (/(unissex|sem genero)/.test(s)) return { id: GENERO_ID.sem_genero, nome: "Sem gênero" };
  return null;
}

/** Tipo de calçado (texto pt) → value_id do ML. Undefined se não reconhecido. */
function footwearParaId(valor: string): string | undefined {
  const s = semAcento(valor);
  if (/chinelo/.test(s)) return FOOTWEAR_TYPE_ID.chinelo;
  if (/sandal/.test(s)) return FOOTWEAR_TYPE_ID.sandalia;
  if (/tamanco/.test(s)) return FOOTWEAR_TYPE_ID.tamanco;
  if (/mule/.test(s)) return FOOTWEAR_TYPE_ID.mule;
  return undefined;
}

function primeiroNumero(s: string): number {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : 9999;
}

/**
 * Monta o bundle User Products a partir do Anúncio Final. Puro e determinístico.
 * Falha fechada quando falta dado OBRIGATÓRIO do ML (marca, gênero) ou quando
 * nenhuma variação tem tamanho publicável com medida.
 */
export function montarBundleUserProducts(
  anuncio: AnuncioGerado,
  opts: { pictures?: string[]; tipoAnuncio?: string } = {}
): ResultadoBundle {
  const brand = fichaValor(anuncio, ["marca"]);
  if (!brand) return { ok: false, motivo: "marca ausente na ficha técnica (obrigatória no ML)" };

  const genero = generoParaId(fichaValor(anuncio, ["genero", "gênero", "genero (masculino/feminino)"]));
  if (!genero) {
    return { ok: false, motivo: "gênero ausente ou não reconhecido na ficha técnica (obrigatório)" };
  }

  const footwearTypeId = footwearParaId(fichaValor(anuncio, ["tipo de calcado", "tipo de calçado"]));
  const familyName = (anuncio.tituloOtimizado || brand).slice(0, 60);
  const model = fichaValor(anuncio, ["modelo"]) || familyName;
  const descricao = anuncio.descricaoCompleta || anuncio.descricaoCurta || "";

  const cmPorTamanho = medidasDaMarca(brand);

  const variacoes: VariacaoUP[] = [];
  const cmPorTamanhoNaGuia = new Map<string, number>();
  const vistos = new Set<string>();

  for (const v of anuncio.variacoes ?? []) {
    const norm = normalizarTamanho(v.tamanho);
    if (!norm.ok) continue; // tamanho ambíguo/faixa → não publica (nada é inventado)
    const cm = cmPorTamanho[norm.valor];
    if (cm === undefined) continue; // sem medida da marca → não entra na guia

    const cor = (v.cor ?? "").trim();
    const chave = `${norm.valor}|${cor.toLowerCase()}`;
    if (vistos.has(chave)) continue; // dedup por (tamanho, cor)
    vistos.add(chave);

    cmPorTamanhoNaGuia.set(norm.valor, cm);
    variacoes.push({
      tamanho: norm.valor,
      cor: cor || undefined,
      sku: (v.sku ?? "").trim() || undefined,
      ean: (v.ean ?? "").trim() || undefined,
      estoque: paraNumero(v.estoque),
      preco: paraNumero(v.preco),
    });
  }

  if (variacoes.length === 0) {
    return {
      ok: false,
      motivo: `nenhuma variação com tamanho publicável + medida da marca "${brand}"`,
    };
  }

  const guiaLinhas: LinhaGuiaTamanho[] = [...cmPorTamanhoNaGuia.entries()]
    .sort((a, b) => primeiroNumero(a[0]) - primeiroNumero(b[0]))
    .map(([tamanho, footLengthCm]) => ({ tamanho, footLengthCm }));

  return {
    ok: true,
    bundle: {
      familyName,
      tipoAnuncio: opts.tipoAnuncio ?? "Premium",
      brand,
      model,
      descricao,
      generoId: genero.id,
      generoNome: genero.nome,
      footwearTypeId,
      pictures: opts.pictures ?? [],
      guiaLinhas,
      variacoes,
    },
  };
}
