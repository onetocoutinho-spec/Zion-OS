// Interface de repositório do Produto Mestre — CONTRATO PURO (Port).
//
// Vive no domínio (inversão de dependência): a implementação Supabase será um
// adaptador de Infra num PR futuro. Aqui NÃO há I/O — apenas a forma. Os métodos
// são assíncronos só na assinatura (Promise), sem tocar em banco/rede neste PR.
// A busca por sku_origem existe porque é a chave 1ª de conciliação (001 §1).

import type { ProdutoMestre } from "./produto-mestre.ts";
import type { IdCliente, IdProdutoMestre } from "../shared/value-objects/identificador.ts";
import type { SkuOrigem } from "../shared/value-objects/sku-origem.ts";

export interface RepositorioProdutoMestre {
  salvar(produtoMestre: ProdutoMestre): Promise<void>;
  porId(id: IdProdutoMestre): Promise<ProdutoMestre | null>;
  /** Conciliação: um Produto Mestre por (cliente, sku_origem). */
  porSkuOrigem(clienteId: IdCliente, skuOrigem: SkuOrigem): Promise<ProdutoMestre | null>;
  listarDoCliente(clienteId: IdCliente): Promise<ProdutoMestre[]>;
}
