// ConectorErp — especialização para ERPs (003 ErpConnector; ex. futuro: Magazord).
// O ERP é dono de estoque/custo/fiscal (000/001); a Zion propaga cadastro/preço
// e ESPELHA estoque/custo. APENAS CONTRATO.

import type { Conector } from "./conector.ts";
import type { Resultado } from "./shared/resultado.ts";
import type { ContextoConector } from "./shared/tipos-conector.ts";
import type { ResultadoOperacao } from "./shared/operacao.ts";
import type { ProdutoCanonico } from "./shared/canonical/produto-canonico.ts";
import type { CustoCanonico, EstoqueCanonico } from "./shared/canonical/erp.ts";

export interface ConectorErp extends Conector {
  /** Lê o estoque oficial do ERP (read model). */
  lerEstoque(contexto: ContextoConector, sku: string): Promise<Resultado<EstoqueCanonico>>;

  /** Lê o custo oficial do ERP (read model). */
  lerCusto(contexto: ContextoConector, sku: string): Promise<Resultado<CustoCanonico>>;

  /** Propaga o cadastro/atualização do produto ao ERP (idempotente). Devolve erp_sku no idExterno. */
  propagar(contexto: ContextoConector, produto: ProdutoCanonico): Promise<ResultadoOperacao>;
}
