// Adaptador HTTP (I/O) do MagazordApi — a ÚNICA peça que fala rede e segredo.
//
// ⚠️ Os CAMINHOS e o esquema de autenticação abaixo são um MODELO. Confirmar com
// a documentação oficial da Magazord na integração real (não há doc/credencial
// neste ambiente). O contrato estável para o resto do sistema é o Port
// `MagazordApi` — trocar endpoints/auth aqui não afeta o conector, o domínio nem
// a Application.
//
// Segredo: o `token` chega JÁ RESOLVIDO server-side (via ResolvedorCredencial do
// SDK, num composition root futuro). Nunca é lido do navegador nem retornado.
// NÃO coberto por teste unitário (é a borda de integração).

import type { MagazordApi, FiltroListagem } from "./magazord-api.ts";
import type {
  CategoriaMagazordRaw,
  ImagemMagazordRaw,
  ProdutoMagazordRaw,
  VariacaoMagazordRaw,
} from "./tipos-magazord.ts";

export interface ConfigMagazordFetch {
  readonly baseUrl: string;
  /** Token resolvido server-side. */
  readonly token: string;
  /** Header de autenticação (padrão "Authorization"). */
  readonly headerAuth?: string;
  /** Esquema do header (padrão "Bearer"; alguns ERPs usam "Basic"/token puro). */
  readonly esquema?: string;
}

export class MagazordApiFetch implements MagazordApi {
  private readonly cfg: ConfigMagazordFetch;

  constructor(cfg: ConfigMagazordFetch) {
    this.cfg = cfg;
  }

  private async get<T>(caminho: string): Promise<T> {
    const header = this.cfg.headerAuth ?? "Authorization";
    const esquema = this.cfg.esquema ?? "Bearer";
    const resposta = await fetch(`${this.cfg.baseUrl}${caminho}`, {
      method: "GET",
      headers: {
        [header]: `${esquema} ${this.cfg.token}`.trim(),
        Accept: "application/json",
      },
    });
    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }
    return (await resposta.json()) as T;
  }

  async buscarProduto(id: string): Promise<ProdutoMagazordRaw | null> {
    return this.get<ProdutoMagazordRaw | null>(`/produtos/${encodeURIComponent(id)}`);
  }

  async listarProdutos(filtro: FiltroListagem): Promise<ProdutoMagazordRaw[]> {
    const qs = new URLSearchParams();
    if (filtro.desde) qs.set("desde", filtro.desde);
    if (filtro.limite !== undefined) qs.set("limite", String(filtro.limite));
    if (filtro.pagina !== undefined) qs.set("pagina", String(filtro.pagina));
    const sufixo = qs.toString() ? `?${qs.toString()}` : "";
    return this.get<ProdutoMagazordRaw[]>(`/produtos${sufixo}`);
  }

  async buscarVariacoes(produtoId: string): Promise<VariacaoMagazordRaw[]> {
    return this.get<VariacaoMagazordRaw[]>(`/produtos/${encodeURIComponent(produtoId)}/variacoes`);
  }

  async buscarImagens(produtoId: string): Promise<ImagemMagazordRaw[]> {
    return this.get<ImagemMagazordRaw[]>(`/produtos/${encodeURIComponent(produtoId)}/imagens`);
  }

  async listarCategorias(): Promise<CategoriaMagazordRaw[]> {
    return this.get<CategoriaMagazordRaw[]>(`/categorias`);
  }
}
