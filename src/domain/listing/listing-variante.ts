// ListingVariante — mapeia uma Variante do Produto Mestre para a variação no
// canal (001 LISTING_VARIANTE). Guarda o id de variação do marketplace e o
// preço/estoque efetivamente enviados. Sem I/O.

import type { Result } from "../shared/resultado.ts";
import { ok, okVazio, falha } from "../shared/resultado.ts";
import { erroDominio } from "../shared/erros-dominio.ts";
import type {
  IdListing,
  IdListingVariante,
  IdVariante,
} from "../shared/value-objects/identificador.ts";
import type { Dinheiro } from "../shared/value-objects/dinheiro.ts";

export type StatusEnvio = "pendente" | "enviado" | "erro";

export interface DadosListingVariante {
  readonly id: IdListingVariante;
  readonly listingId: IdListing;
  readonly varianteId: IdVariante;
}

export class ListingVariante {
  readonly id: IdListingVariante;
  readonly listingId: IdListing;
  readonly varianteId: IdVariante;

  private _marketplaceVariationId: string | null;
  private _precoEnviado: Dinheiro | null;
  private _estoqueEnviado: number | null;
  private _statusEnvio: StatusEnvio;

  private constructor(dados: DadosListingVariante) {
    this.id = dados.id;
    this.listingId = dados.listingId;
    this.varianteId = dados.varianteId;
    this._marketplaceVariationId = null;
    this._precoEnviado = null;
    this._estoqueEnviado = null;
    this._statusEnvio = "pendente";
  }

  static criar(dados: DadosListingVariante): Result<ListingVariante> {
    return ok(new ListingVariante(dados));
  }

  get marketplaceVariationId(): string | null {
    return this._marketplaceVariationId;
  }

  get statusEnvio(): StatusEnvio {
    return this._statusEnvio;
  }

  get precoEnviado(): Dinheiro | null {
    return this._precoEnviado;
  }

  get estoqueEnviado(): number | null {
    return this._estoqueEnviado;
  }

  pertenceAoListing(listingId: IdListing): boolean {
    return this.listingId === listingId;
  }

  /** Registra o resultado do envio ao canal (id de variação + preço/estoque enviados). */
  confirmarEnvio(marketplaceVariationId: string, preco: Dinheiro, estoque: number): Result<void> {
    if (marketplaceVariationId.trim().length === 0) {
      return falha(erroDominio("campo_obrigatorio", "id de variação do marketplace é obrigatório."));
    }
    if (!Number.isInteger(estoque) || estoque < 0) {
      return falha(erroDominio("estoque_negativo", "Estoque enviado deve ser inteiro >= 0."));
    }
    this._marketplaceVariationId = marketplaceVariationId;
    this._precoEnviado = preco;
    this._estoqueEnviado = estoque;
    this._statusEnvio = "enviado";
    return okVazio();
  }
}
