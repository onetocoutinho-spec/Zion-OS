// ConectorOrigem — especialização para a Origem do Produto (003 SupplierConnector).
// Cobre qualquer tipo de origem (fornecedor/fabricante/importador/distribuidor/
// marca própria) e qualquer formato (Excel/CSV/XML/PDF/API/Drive/B2B).
// APENAS CONTRATO.

import type { Conector } from "./conector.ts";
import type { Resultado } from "./shared/resultado.ts";
import type { ContextoConector } from "./shared/tipos-conector.ts";
import type { FonteIngestao, PreProdutoCanonico } from "./shared/canonical/ingestao.ts";

export interface ConectorOrigem extends Conector {
  /** Recebe o catálogo como está e devolve pré-produtos canônicos (para o Intake). */
  ingerir(contexto: ContextoConector, fonte: FonteIngestao): Promise<Resultado<PreProdutoCanonico[]>>;
}
