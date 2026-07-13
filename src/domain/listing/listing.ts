// Listing — a PUBLICAÇÃO de um Produto Mestre num canal/conta (001 LISTING).
//
// Invariantes:
//   - Toda publicação deriva de um Produto Mestre (produtoMestreId obrigatório).
//   - Listing existe só para marketplace (nunca canal "zion").
//   - marketplaceItemId nasce null e só é preenchido ao publicar (marcarPublicado).
//   - Estado segue a máquina de estados-listing.ts.
// Sem I/O (o Marketplace Engine/Adapter — fora deste PR — é quem chama o canal).

import type { Result } from "../shared/resultado.ts";
import { ok, okVazio, falha } from "../shared/resultado.ts";
import { erroDominio } from "../shared/erros-dominio.ts";
import type { IdListing, IdProdutoMestre } from "../shared/value-objects/identificador.ts";
import { ehCanalMarketplace, type CanalMarketplace } from "../shared/value-objects/canal.ts";
import { podeTransicionarListing, type StatusListing } from "./estados-listing.ts";
import { ListingVariante } from "./listing-variante.ts";

export const MODELOS_PUBLICACAO = ["classico", "user_products", "canal_especifico"] as const;
export type ModeloPublicacao = (typeof MODELOS_PUBLICACAO)[number];

export interface DadosCriacaoListing {
  readonly id: IdListing;
  readonly produtoMestreId: IdProdutoMestre;
  readonly canal: CanalMarketplace;
  /** Referência à conta/loja no marketplace (canal_conta_id em 001). */
  readonly canalContaId: string;
  readonly modeloPublicacao: ModeloPublicacao;
  readonly agora: string;
}

export class Listing {
  readonly id: IdListing;
  readonly produtoMestreId: IdProdutoMestre;
  readonly canal: CanalMarketplace;
  readonly canalContaId: string;
  readonly modeloPublicacao: ModeloPublicacao;

  private _marketplaceItemId: string | null;
  private _permalink: string | null;
  private _status: StatusListing;
  private _publicadoEm: string | null;
  private _atualizadoEm: string;
  private readonly _variantes: ListingVariante[];

  private constructor(dados: DadosCriacaoListing) {
    this.id = dados.id;
    this.produtoMestreId = dados.produtoMestreId;
    this.canal = dados.canal;
    this.canalContaId = dados.canalContaId;
    this.modeloPublicacao = dados.modeloPublicacao;
    this._marketplaceItemId = null;
    this._permalink = null;
    this._status = "rascunho";
    this._publicadoEm = null;
    this._atualizadoEm = dados.agora;
    this._variantes = [];
  }

  static criarRascunho(dados: DadosCriacaoListing): Result<Listing> {
    if (!ehCanalMarketplace(dados.canal)) {
      return falha(
        erroDominio("listing_canal_invalido", "Listing exige um canal de marketplace (não 'zion')."),
      );
    }
    if (dados.canalContaId.trim().length === 0) {
      return falha(erroDominio("campo_obrigatorio", "Listing exige a conta do marketplace."));
    }
    return ok(new Listing(dados));
  }

  get status(): StatusListing {
    return this._status;
  }

  get marketplaceItemId(): string | null {
    return this._marketplaceItemId;
  }

  get permalink(): string | null {
    return this._permalink;
  }

  get publicadoEm(): string | null {
    return this._publicadoEm;
  }

  get variantes(): readonly ListingVariante[] {
    return [...this._variantes];
  }

  /** Mapeia uma variação; a ListingVariante deve pertencer a este Listing e não duplicar variante. */
  mapearVariante(listingVariante: ListingVariante): Result<void> {
    if (!listingVariante.pertenceAoListing(this.id)) {
      return falha(erroDominio("variante_nao_pertence", "ListingVariante não pertence a este Listing."));
    }
    const dup = this._variantes.some(
      (lv) => lv.varianteId === listingVariante.varianteId || lv.id === listingVariante.id,
    );
    if (dup) {
      return falha(erroDominio("variante_duplicada", "Variação já mapeada neste Listing."));
    }
    this._variantes.push(listingVariante);
    return okVazio();
  }

  /** Publica: exige item id do marketplace; transição rascunho/erro → publicado. */
  marcarPublicado(marketplaceItemId: string, permalink: string | null, agora: string): Result<void> {
    if (marketplaceItemId.trim().length === 0) {
      return falha(erroDominio("campo_obrigatorio", "Publicação exige marketplace_item_id."));
    }
    const t = this.transicionar("publicado", agora);
    if (!t.ok) return t;
    this._marketplaceItemId = marketplaceItemId;
    this._permalink = permalink;
    this._publicadoEm = agora;
    return okVazio();
  }

  ativar(agora: string): Result<void> {
    return this.transicionar("ativo", agora);
  }

  pausar(agora: string): Result<void> {
    return this.transicionar("pausado", agora);
  }

  encerrar(agora: string): Result<void> {
    return this.transicionar("encerrado", agora);
  }

  marcarErro(agora: string): Result<void> {
    return this.transicionar("erro", agora);
  }

  private transicionar(para: StatusListing, agora: string): Result<void> {
    if (!podeTransicionarListing(this._status, para)) {
      return falha(
        erroDominio("transicao_invalida", `Transição de listing inválida: ${this._status} → ${para}.`),
      );
    }
    this._status = para;
    this._atualizadoEm = agora;
    return okVazio();
  }
}
