// Variante — a unidade vendável (SKU) de um Produto Mestre (001).
//
// FRONTEIRA DE FONTE DA VERDADE (000/001):
//   - preço de venda  → dono é a Zion  → `definirPrecoVenda()`
//   - estoque/custo   → dono é o ERP   → SOMENTE `aplicarEspelhoErp()` (read model)
// Não existe setter de estoque/custo fora do espelho: a Zion nunca inventa esses
// números. A invariante "variante pertence a um Produto Mestre" é garantida pelo
// agregado (produtoMestreId + checagem em adicionarVariante).

import type { Result } from "../shared/resultado.ts";
import { ok, okVazio, falha } from "../shared/resultado.ts";
import { erroDominio } from "../shared/erros-dominio.ts";
import type { IdProdutoMestre, IdVariante } from "../shared/value-objects/identificador.ts";
import type { SkuOrigem } from "../shared/value-objects/sku-origem.ts";
import type { Ean } from "../shared/value-objects/ean.ts";
import type { Dinheiro } from "../shared/value-objects/dinheiro.ts";

export interface EspelhoErp {
  readonly estoque: number;
  readonly custo: Dinheiro;
}

export interface DadosVariante {
  readonly id: IdVariante;
  readonly produtoMestreId: IdProdutoMestre;
  readonly skuZion: string;
  readonly skuOrigemVariacao: SkuOrigem | null;
  readonly ean: Ean | null;
  readonly cor: string | null;
  readonly tamanho: string | null;
  readonly precoVenda: Dinheiro;
}

export class Variante {
  readonly id: IdVariante;
  readonly produtoMestreId: IdProdutoMestre;
  readonly skuZion: string;
  readonly skuOrigemVariacao: SkuOrigem | null;
  readonly ean: Ean | null;
  readonly cor: string | null;
  readonly tamanho: string | null;

  private _precoVenda: Dinheiro;
  private _espelhoErp: EspelhoErp | null;

  private constructor(dados: DadosVariante) {
    this.id = dados.id;
    this.produtoMestreId = dados.produtoMestreId;
    this.skuZion = dados.skuZion;
    this.skuOrigemVariacao = dados.skuOrigemVariacao;
    this.ean = dados.ean;
    this.cor = dados.cor;
    this.tamanho = dados.tamanho;
    this._precoVenda = dados.precoVenda;
    this._espelhoErp = null;
  }

  static criar(dados: DadosVariante): Result<Variante> {
    if (dados.skuZion.trim().length === 0) {
      return falha(erroDominio("campo_obrigatorio", "Variante exige um SKU Zion."));
    }
    return ok(new Variante(dados));
  }

  get precoVenda(): Dinheiro {
    return this._precoVenda;
  }

  get espelhoErp(): EspelhoErp | null {
    return this._espelhoErp;
  }

  get estoqueErp(): number | null {
    return this._espelhoErp ? this._espelhoErp.estoque : null;
  }

  get custoErp(): Dinheiro | null {
    return this._espelhoErp ? this._espelhoErp.custo : null;
  }

  pertenceA(produtoMestreId: IdProdutoMestre): boolean {
    return this.produtoMestreId === produtoMestreId;
  }

  /** Zion é dona do preço de venda (001 §6). */
  definirPrecoVenda(novo: Dinheiro): Result<void> {
    this._precoVenda = novo;
    return okVazio();
  }

  /** ÚNICO caminho para estoque/custo — reflete o ERP (001 §7). */
  aplicarEspelhoErp(estoque: number, custo: Dinheiro): Result<void> {
    if (!Number.isInteger(estoque) || estoque < 0) {
      return falha(erroDominio("estoque_negativo", "Estoque do ERP deve ser inteiro >= 0."));
    }
    this._espelhoErp = { estoque, custo };
    return okVazio();
  }
}
