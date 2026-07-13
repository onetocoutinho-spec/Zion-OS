// ConectorMarketplace — especialização para marketplaces (003; refinado no 002).
// Cobre ML/TikTok/Shopee/futuros pelo MESMO contrato: publicar, atualizar
// preço/estoque, pausar, importar, processar webhook, mapear categoria.
// APENAS CONTRATO — nenhuma regra de canal aqui (fica no Adapter concreto, PR futuro).

import type { Conector } from "./conector.ts";
import type { Resultado } from "./shared/resultado.ts";
import type { ContextoConector } from "./shared/tipos-conector.ts";
import type { ResultadoOperacao } from "./shared/operacao.ts";
import type { ProdutoCanonico } from "./shared/canonical/produto-canonico.ts";
import type {
  CategoriaCanalCanonica,
  EventoWebhook,
  FiltroImportacao,
  ResultadoWebhook,
  SolicitacaoPublicacao,
} from "./shared/canonical/marketplace.ts";

export interface ConectorMarketplace extends Conector {
  /** Publica um produto no canal (idempotente). idExterno = marketplace_item_id. */
  publicar(contexto: ContextoConector, solicitacao: SolicitacaoPublicacao): Promise<ResultadoOperacao>;

  /** Atualiza preço/estoque de um item já publicado (idempotente). */
  atualizarPrecoEstoque(contexto: ContextoConector, produto: ProdutoCanonico): Promise<ResultadoOperacao>;

  /** Pausa um item no canal. */
  pausar(contexto: ContextoConector, marketplaceItemId: string): Promise<ResultadoOperacao>;

  /** Importa anúncios existentes do canal para o formato canônico. */
  importarAnuncios(contexto: ContextoConector, filtro: FiltroImportacao): Promise<Resultado<ProdutoCanonico[]>>;

  /** Normaliza um webhook do canal em um evento de domínio (sem segredo). */
  processarWebhook(contexto: ContextoConector, evento: EventoWebhook): Promise<Resultado<ResultadoWebhook>>;

  /** Mapeia um produto para a categoria/modelo de publicação do canal. */
  mapearCategoria(contexto: ContextoConector, produto: ProdutoCanonico): Promise<Resultado<CategoriaCanalCanonica>>;
}
