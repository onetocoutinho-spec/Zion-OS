// Tipos canônicos do MarketplaceConnector (002/003). Refinados no 002; aqui
// ficam apenas as formas neutras de entrada/saída (sem regra de canal).

import type { ProdutoCanonico } from "./produto-canonico.ts";

export const MODELOS_PUBLICACAO = ["classico", "user_products", "canal_especifico"] as const;
export type ModeloPublicacao = (typeof MODELOS_PUBLICACAO)[number];

export interface SolicitacaoPublicacao {
  readonly produto: ProdutoCanonico;
  readonly modeloPublicacao: ModeloPublicacao;
}

export interface FiltroImportacao {
  /** Marca d'água/consulta para importar anúncios (ISO ou termo). */
  readonly desde?: string;
  readonly limite?: number;
}

export interface CategoriaCanalCanonica {
  readonly idCanal: string;
  readonly caminho: string;
  readonly modeloPublicacao: ModeloPublicacao;
}

/** Webhook recebido de um canal — normalizado, SEM segredo/assinatura crua. */
export interface EventoWebhook {
  readonly provedor: string;
  readonly tipoBruto: string;
  readonly corpo: Record<string, unknown>;
}

export interface ResultadoWebhook {
  /** Tipo de evento de domínio derivado (ex.: "venda.recebida"). */
  readonly tipoDominio: string;
  readonly recursoId?: string | null;
}
