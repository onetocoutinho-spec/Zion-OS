// Interface de repositório do Listing — CONTRATO PURO (Port).
// Implementação de Infra fica para PR futuro. Sem I/O aqui.

import type { Listing } from "./listing.ts";
import type { CanalMarketplace } from "../shared/value-objects/canal.ts";
import type { IdListing, IdProdutoMestre } from "../shared/value-objects/identificador.ts";

export interface RepositorioListing {
  salvar(listing: Listing): Promise<void>;
  porId(id: IdListing): Promise<Listing | null>;
  listarDoProdutoMestre(produtoMestreId: IdProdutoMestre): Promise<Listing[]>;
  /** Reconciliação: achar o Listing pelo id do item no marketplace. */
  porItemDeMarketplace(canal: CanalMarketplace, marketplaceItemId: string): Promise<Listing | null>;
}
