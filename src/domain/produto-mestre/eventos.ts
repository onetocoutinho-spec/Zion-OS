// Fábricas de eventos de domínio do Produto Mestre.
//
// Apenas CONSTROEM o envelope (formato do 004). O agregado os registra em
// memória (puxarEventos). Sem transporte/bus neste PR. `occurred_at` injetado.
// Nomes de tipo seguem o catálogo de 001/004.

import type { EventoDominio } from "../shared/evento-dominio.ts";
import type { IdProdutoMestre, IdVariante } from "../shared/value-objects/identificador.ts";
import type { Canal } from "../shared/value-objects/canal.ts";
import type { CampoDiff } from "./versao.ts";

const VERSAO_SCHEMA = 1;

export function produtoMestreCriado(
  id: IdProdutoMestre,
  dados: { sku_origem: string; modo_operacao: string },
  occurred_at: string,
): EventoDominio {
  return {
    tipo: "produto_mestre.criado",
    versao_schema: VERSAO_SCHEMA,
    chave_particao: id,
    occurred_at,
    payload: { produto_mestre_id: id, ...dados },
  };
}

export function produtoMestreAtualizado(
  id: IdProdutoMestre,
  versao: number,
  diff: readonly CampoDiff[],
  occurred_at: string,
): EventoDominio {
  return {
    tipo: "produto_mestre.atualizado",
    versao_schema: VERSAO_SCHEMA,
    chave_particao: id,
    occurred_at,
    payload: { produto_mestre_id: id, versao, diff },
  };
}

export function varianteAtualizada(
  produtoMestreId: IdProdutoMestre,
  varianteId: IdVariante,
  occurred_at: string,
): EventoDominio {
  return {
    tipo: "variante.atualizada",
    versao_schema: VERSAO_SCHEMA,
    chave_particao: produtoMestreId,
    occurred_at,
    payload: { produto_mestre_id: produtoMestreId, variante_id: varianteId },
  };
}

export function precoDefinido(
  produtoMestreId: IdProdutoMestre,
  varianteId: IdVariante,
  canal: Canal,
  occurred_at: string,
): EventoDominio {
  return {
    tipo: "preco.definido",
    versao_schema: VERSAO_SCHEMA,
    chave_particao: produtoMestreId,
    occurred_at,
    payload: { produto_mestre_id: produtoMestreId, variante_id: varianteId, canal },
  };
}

export function estoqueEspelhado(
  produtoMestreId: IdProdutoMestre,
  varianteId: IdVariante,
  estoque: number,
  occurred_at: string,
): EventoDominio {
  return {
    tipo: "estoque.espelhado",
    versao_schema: VERSAO_SCHEMA,
    chave_particao: produtoMestreId,
    occurred_at,
    payload: { produto_mestre_id: produtoMestreId, variante_id: varianteId, estoque },
  };
}
