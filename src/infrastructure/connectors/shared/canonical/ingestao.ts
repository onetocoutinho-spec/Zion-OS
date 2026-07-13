// Ingestão de origem (003 §C2 / SupplierConnector) — formato bruto recebido do
// fornecedor/fabricante, antes de virar Pré-Produto no Intake (006).

import type { IdentidadeCanonica } from "./identidade.ts";

export const FORMATOS_FONTE = ["excel", "csv", "xml", "pdf", "api", "drive", "b2b"] as const;
export type FormatoFonte = (typeof FORMATOS_FONTE)[number];

export interface FonteIngestao {
  readonly formato: FormatoFonte;
  /** Arquivo/URL/endpoint — referência SEM segredo. */
  readonly referencia: string;
}

export interface PreProdutoCanonico {
  readonly identidade: IdentidadeCanonica;
  /** Linha/registro cru como veio da origem (para normalização posterior). */
  readonly dadosBrutos: Record<string, unknown>;
}
