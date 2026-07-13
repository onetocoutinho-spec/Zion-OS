// Anticorrupção: converte o formato CRU da Magazord → DTO CANÔNICO do SDK.
//
// Funções PURAS (sem I/O). Produtos/variações → ProdutoCanonico/VarianteCanonica
// (SDK). Imagens/categorias → DTOs locais (o SDK não define esses canônicos e
// este PR não o altera). Estoque/custo/preço NÃO são mapeados (fora de escopo:
// leitura de catálogo). Nenhuma regra de negócio aqui.

import type { IdentidadeCanonica } from "../../shared/canonical/identidade.ts";
import type { ProdutoCanonico, VarianteCanonica } from "../../shared/canonical/produto-canonico.ts";
import type {
  CategoriaLida,
  CategoriaMagazordRaw,
  ImagemLida,
  ImagemMagazordRaw,
  ProdutoMagazordRaw,
  VariacaoMagazordRaw,
} from "./tipos-magazord.ts";

function texto(valor: string | null | undefined): string | null {
  return valor && valor.trim() !== "" ? valor.trim() : null;
}

function paraStr(valor: number | string): string {
  return String(valor);
}

/**
 * Identidade canônica (001): `sku_origem` é a chave 1ª (usa o SKU de fornecedor
 * se registrado, senão cai para o código Magazord); `erp_sku` é sempre o código
 * Magazord; `ean` é complementar.
 */
export function identidadeDe(
  codigo: string,
  skuFornecedor: string | null | undefined,
  ean: string | null | undefined,
): IdentidadeCanonica {
  const forn = texto(skuFornecedor);
  return {
    skuOrigem: forn ?? codigo,
    ean: texto(ean),
    erpSku: codigo,
  };
}

export function paraVarianteCanonica(raw: VariacaoMagazordRaw): VarianteCanonica {
  return {
    identidade: identidadeDe(raw.codigo, raw.skuFornecedor, raw.ean),
    cor: texto(raw.cor),
    tamanho: texto(raw.tamanho),
    // precoVenda/estoqueErp/custoErp omitidos de propósito (read-only de catálogo).
  };
}

export function paraProdutoCanonico(raw: ProdutoMagazordRaw): ProdutoCanonico {
  const variantes = (raw.variacoes ?? []).map(paraVarianteCanonica);
  const categoria = raw.categoria ? texto(raw.categoria.caminho) ?? texto(raw.categoria.nome) : null;
  return {
    identidade: identidadeDe(raw.codigo, raw.skuFornecedor, raw.ean),
    nome: raw.nome,
    marca: texto(raw.marca),
    modelo: texto(raw.modelo),
    categoriaZion: categoria,
    descricaoBase: texto(raw.descricao),
    variantes,
  };
}

export function paraImagemLida(raw: ImagemMagazordRaw, indice: number): ImagemLida {
  return {
    url: raw.url,
    ordem: raw.ordem ?? indice,
    principal: raw.principal ?? indice === 0,
  };
}

export function paraCategoriaLida(raw: CategoriaMagazordRaw): CategoriaLida {
  return {
    id: paraStr(raw.id),
    nome: raw.nome,
    caminho: texto(raw.caminho),
    paiId: raw.paiId !== null && raw.paiId !== undefined ? paraStr(raw.paiId) : null,
  };
}
