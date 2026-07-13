// DTOs de saída (Domain → DTO). Formas serializáveis (strings/números), sem tipos
// do domínio nem comportamento. É o que a Application devolve para as bordas
// (HTTP/UI, em PRs futuros) — a Application não conhece HTTP, só produz o DTO.

export interface VarianteDTO {
  readonly id: string;
  readonly skuZion: string;
  readonly skuOrigemVariacao: string | null;
  readonly ean: string | null;
  readonly cor: string | null;
  readonly tamanho: string | null;
  readonly precoVenda: number;
  /** Espelho do ERP (read-only). null quando ainda não espelhado. */
  readonly estoqueErp: number | null;
  readonly custoErp: number | null;
}

export interface ProdutoMestreDTO {
  readonly id: string;
  readonly organizacaoId: string;
  readonly clienteId: string;
  readonly origemProdutoId: string;
  readonly origemInterna: boolean;
  readonly catalogoId: string | null;
  readonly modoOperacao: string;
  readonly skuOrigem: string;
  readonly ean: string | null;
  readonly nome: string;
  readonly marca: string | null;
  readonly modelo: string | null;
  readonly categoriaZion: string | null;
  readonly descricaoBase: string | null;
  readonly status: string;
  readonly versaoAtual: number;
  readonly variantes: ReadonlyArray<VarianteDTO>;
}
