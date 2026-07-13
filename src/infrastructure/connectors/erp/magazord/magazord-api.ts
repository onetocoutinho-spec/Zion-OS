// Port do HTTP da Magazord (read-only) — a costura de I/O.
//
// O MagazordConnector depende DESTA abstração (não de fetch/rede). A implementação
// concreta é o MagazordApiFetch (magazord-api-fetch.ts); os testes injetam um fake.
// Assim o conector é 100% testável sem rede, e o formato externo fica isolado.

import type {
  CategoriaMagazordRaw,
  ImagemMagazordRaw,
  ProdutoMagazordRaw,
  VariacaoMagazordRaw,
} from "./tipos-magazord.ts";

export interface FiltroListagem {
  /** Marca d'água para leitura incremental (ISO). */
  readonly desde?: string;
  readonly limite?: number;
  readonly pagina?: number;
}

export interface MagazordApi {
  buscarProduto(id: string): Promise<ProdutoMagazordRaw | null>;
  listarProdutos(filtro: FiltroListagem): Promise<ProdutoMagazordRaw[]>;
  buscarVariacoes(produtoId: string): Promise<VariacaoMagazordRaw[]>;
  buscarImagens(produtoId: string): Promise<ImagemMagazordRaw[]>;
  listarCategorias(): Promise<CategoriaMagazordRaw[]>;
}
