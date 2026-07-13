// Shapes CRUS da resposta da API Magazord (read-only).
//
// ⚠️ MODELO a confirmar com a documentação oficial da Magazord na integração
// real — não há credencial/doc neste ambiente. O contrato ESTÁVEL é o Port
// `MagazordApi` + os mapeadores; ajustar estes campos NÃO afeta domínio/app,
// pois a conversão para o DTO canônico isola o formato externo (anticorrupção).
//
// Estoque/custo/preço NÃO aparecem aqui: são fora do escopo deste PR (somente
// leitura de catálogo). Entram num PR futuro de ERP (estoque/custo/propagação).

export interface CategoriaMagazordRaw {
  readonly id: number | string;
  readonly nome: string;
  /** Caminho hierárquico, ex.: "Áudio > Fones". */
  readonly caminho?: string | null;
  readonly paiId?: number | string | null;
}

export interface ImagemMagazordRaw {
  readonly url: string;
  readonly ordem?: number | null;
  readonly principal?: boolean | null;
}

export interface VariacaoMagazordRaw {
  readonly id: number | string;
  /** Código da variação no Magazord (→ erp_sku). */
  readonly codigo: string;
  /** SKU de origem/fornecedor, se registrado no ERP (→ sku_origem). */
  readonly skuFornecedor?: string | null;
  readonly ean?: string | null;
  readonly cor?: string | null;
  readonly tamanho?: string | null;
}

export interface ProdutoMagazordRaw {
  readonly id: number | string;
  /** Código do produto no Magazord (→ erp_sku). */
  readonly codigo: string;
  readonly skuFornecedor?: string | null;
  readonly ean?: string | null;
  readonly nome: string;
  readonly marca?: string | null;
  readonly modelo?: string | null;
  readonly descricao?: string | null;
  readonly categoria?: CategoriaMagazordRaw | null;
  readonly variacoes?: ReadonlyArray<VariacaoMagazordRaw> | null;
  readonly imagens?: ReadonlyArray<ImagemMagazordRaw> | null;
}

// DTOs de leitura LOCAIS: o SDK canônico não define imagem nem categoria de ERP,
// e este PR não altera o SDK. Produtos/variações usam o canônico do SDK
// (ProdutoCanonico/VarianteCanonica); imagens/categorias ficam nestes tipos até
// o SDK ganhar um canônico próprio (fora de escopo).
export interface ImagemLida {
  readonly url: string;
  readonly ordem: number;
  readonly principal: boolean;
}

export interface CategoriaLida {
  readonly id: string;
  readonly nome: string;
  readonly caminho: string | null;
  readonly paiId: string | null;
}
