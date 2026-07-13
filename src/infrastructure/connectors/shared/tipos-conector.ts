// Tipos base do conector (003 §Escopo — ContextoConector, capacidades, tipo).
//
// TipoConector usa a linguagem oficial de 000 ("origem" = Origem do Produto,
// equivalente ao "supplier" do 003). Ids são strings de transporte (o SDK não
// importa os Ids branded do domínio — camada de fronteira independente).

import type { Capacidades } from "./capacidades.ts";
import type { Limites } from "./limites.ts";
import type { ReferenciaCredencial } from "./auth/credencial.ts";

export const TIPOS_CONECTOR = ["origem", "erp", "marketplace"] as const;
export type TipoConector = (typeof TIPOS_CONECTOR)[number];

/** Nome do provedor (ex.: "magazord", "mercado_livre", "excel"). String livre: nenhum é implementado neste PR. */
export type Provedor = string;

export interface Saude {
  readonly ok: boolean;
  readonly verificadoEm: string;
  readonly detalhe?: string;
}

/** Contexto server-side de uma operação: quem, qual conta e o ponteiro da credencial. */
export interface ContextoConector {
  readonly organizacaoId: string;
  readonly clienteId: string;
  /** seller_id / loja / fornecedor no sistema externo. */
  readonly contaExterna: string;
  readonly credencial: ReferenciaCredencial;
}

/** Metadados declarados por um conector — base da suíte de conformidade. */
export interface MetadadosConector {
  readonly tipo: TipoConector;
  readonly provedor: Provedor;
  readonly capacidades: Capacidades;
  readonly limites: Limites;
}
