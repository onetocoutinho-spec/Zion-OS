// Identidade canônica de produto que trafega pelos conectores (001 §Identidade).
//
// DTO de TRANSPORTE (strings) — deliberadamente separado dos Value Objects do
// domínio (SkuOrigem/Ean). Assim mudanças de API externa não vazam para o
// domínio; a Application converte canônico↔domínio (PR futuro).

export interface IdentidadeCanonica {
  /** Chave 1ª de conciliação (001 §1). */
  readonly skuOrigem: string;
  /** Complementar; desempata quando o SKU falha. Ausente = null. */
  readonly ean: string | null;
  /** Código no ERP (Magazord), quando já conhecido. */
  readonly erpSku?: string | null;
}
