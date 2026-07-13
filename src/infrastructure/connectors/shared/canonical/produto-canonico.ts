// Produto canônico de transporte — o formato neutro que entra/sai dos conectores
// (base: Produto Mestre — 001), sem regra de negócio nem tipos de domínio.
// Preços/custos são números simples (o Dinheiro do domínio é aplicado na borda
// de conversão, na Application).

import type { IdentidadeCanonica } from "./identidade.ts";

export interface VarianteCanonica {
  readonly identidade: IdentidadeCanonica;
  readonly skuZion?: string | null;
  readonly cor?: string | null;
  readonly tamanho?: string | null;
  /** Preço de venda (Zion) em reais. */
  readonly precoVenda?: number | null;
  /** Espelho do ERP (read-only na Zion). */
  readonly estoqueErp?: number | null;
  readonly custoErp?: number | null;
}

export interface ProdutoCanonico {
  readonly identidade: IdentidadeCanonica;
  readonly nome: string;
  readonly marca?: string | null;
  readonly modelo?: string | null;
  readonly categoriaZion?: string | null;
  readonly descricaoBase?: string | null;
  readonly variantes: ReadonlyArray<VarianteCanonica>;
}
