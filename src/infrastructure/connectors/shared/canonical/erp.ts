// Tipos canônicos do ErpConnector (003 §ErpConnector). O ERP é a fonte da
// verdade de estoque/custo (000/001 §7); estes DTOs são o read model que a Zion
// espelha.

export interface EstoqueCanonico {
  readonly sku: string;
  readonly quantidade: number;
}

export interface CustoCanonico {
  readonly sku: string;
  /** Custo em reais. */
  readonly valor: number;
}
