// Implementação Supabase do Port ListingRepository — ADIADA (decisão do PR-007).
//
// As migrations 017–021 (PR-006) NÃO criaram a tabela `listing`/`listing_variante`
// (era a migração 022, fora de escopo). Sem tabela canônica, este repositório não
// pode persistir Listings. A classe implementa o Port (o TIPO é satisfeito) mas
// cada método falha com uma mensagem clara até a 022 existir. Estrutura mantida
// para o próximo PR de Listing/Marketplace.

import type { ListingRepository } from "../../../../application/ports/listing-repository.ts";
import type { Listing } from "../../../../domain/listing/listing.ts";

const PENDENTE =
  "ListingRepository pendente da migração 022 (tabela `listing`), fora do escopo 017–021.";

export class ListingRepositorySupabase implements ListingRepository {
  async salvar(): Promise<void> {
    throw new Error(PENDENTE);
  }

  async porId(): Promise<Listing | null> {
    throw new Error(PENDENTE);
  }

  async listarDoProdutoMestre(): Promise<Listing[]> {
    throw new Error(PENDENTE);
  }

  async porItemDeMarketplace(): Promise<Listing | null> {
    throw new Error(PENDENTE);
  }
}
