// Implementação Supabase do Port ProdutoMestreRepository (Application/Domínio).
//
// Concretiza o contrato usando EXCLUSIVAMENTE as tabelas canônicas
// produto_mestre (020) e produto_mestre_versao (021) — nenhum acesso a tabela
// legada. Só orquestra I/O + tradução (mapper); nenhuma regra de negócio.
// `salvar` faz upsert (cria OU atualiza — não há método `atualizar` separado no
// Port). Soft delete não existe no schema canônico; arquivar é uma transição de
// status do domínio (não um DELETE) — por isso não há `remover`.

import type { ProdutoMestreRepository } from "../../../../application/ports/produto-mestre-repository.ts";
import type { ProdutoMestre } from "../../../../domain/produto-mestre/produto-mestre.ts";
import type {
  IdCliente,
  IdProdutoMestre,
} from "../../../../domain/shared/value-objects/identificador.ts";
import { comoId } from "../../../../domain/shared/value-objects/identificador.ts";
import type { SkuOrigem } from "../../../../domain/shared/value-objects/sku-origem.ts";

import type { ClienteSupabase, LinhaDb } from "../shared/supabase-context.ts";
import { igual } from "../shared/query-builder.ts";
import { paraDominio, paraLinha, paraLinhasVersao } from "../mappers/produto-mestre-db-mapper.ts";

const TAB_MESTRE = "produto_mestre";
const TAB_VERSAO = "produto_mestre_versao";

export interface DependenciasProdutoMestreRepo {
  readonly cliente: ClienteSupabase;
}

export class ProdutoMestreRepositorySupabase implements ProdutoMestreRepository {
  private readonly cliente: ClienteSupabase;

  constructor(deps: DependenciasProdutoMestreRepo) {
    this.cliente = deps.cliente;
  }

  async salvar(produtoMestre: ProdutoMestre): Promise<void> {
    const linha = paraLinha(produtoMestre);
    const r1 = await this.cliente.tabela(TAB_MESTRE).upsert([linha], "id");
    if (r1.error) throw new Error(`salvar produto_mestre: ${r1.error.message}`);

    const versoes = paraLinhasVersao(produtoMestre);
    if (versoes.length > 0) {
      const r2 = await this.cliente.tabela(TAB_VERSAO).upsert(versoes, "produto_mestre_id,versao");
      if (r2.error) throw new Error(`salvar produto_mestre_versao: ${r2.error.message}`);
    }
  }

  async porId(id: IdProdutoMestre): Promise<ProdutoMestre | null> {
    const linha = await this.umDe(TAB_MESTRE, [igual("id", id)]);
    if (!linha) return null;
    return paraDominio(linha, await this.versoesDe(id));
  }

  async porSkuOrigem(clienteId: IdCliente, skuOrigem: SkuOrigem): Promise<ProdutoMestre | null> {
    // Busca por (cliente, sku). A unicidade canônica é (cliente, origem, sku):
    // se um cliente reusar SKU entre origens, isto retorna o primeiro — ver a
    // recomendação (PR-006) de incluir origem na assinatura do Port.
    const linha = await this.umDe(TAB_MESTRE, [
      igual("cliente_id", clienteId),
      igual("sku_origem", skuOrigem.valor),
    ]);
    if (!linha) return null;
    const id = comoId<"produto_mestre">(String(linha.id));
    return paraDominio(linha, await this.versoesDe(id));
  }

  async listarDoCliente(clienteId: IdCliente): Promise<ProdutoMestre[]> {
    const r = await this.cliente.tabela(TAB_MESTRE).selecionar([igual("cliente_id", clienteId)]);
    if (r.error) throw new Error(`listar produto_mestre: ${r.error.message}`);
    // Listagem leve: sem histórico por item (histórico é carregado em porId).
    return (r.data ?? []).map((linha) => paraDominio(linha, []));
  }

  /** Extra (fora do Port): conciliação complementar por EAN. */
  async porEan(clienteId: IdCliente, ean: string): Promise<ProdutoMestre | null> {
    const linha = await this.umDe(TAB_MESTRE, [
      igual("cliente_id", clienteId),
      igual("ean", ean),
    ]);
    if (!linha) return null;
    const id = comoId<"produto_mestre">(String(linha.id));
    return paraDominio(linha, await this.versoesDe(id));
  }

  // ---- privados ----

  private async umDe(
    tabela: string,
    filtros: ReadonlyArray<{ coluna: string; valor: unknown }>,
  ): Promise<LinhaDb | null> {
    const r = await this.cliente.tabela(tabela).selecionar(filtros);
    if (r.error) throw new Error(`consultar ${tabela}: ${r.error.message}`);
    return r.data && r.data.length > 0 ? r.data[0] : null;
  }

  private async versoesDe(id: IdProdutoMestre): Promise<LinhaDb[]> {
    const r = await this.cliente.tabela(TAB_VERSAO).selecionar([igual("produto_mestre_id", id)]);
    if (r.error) throw new Error(`consultar produto_mestre_versao: ${r.error.message}`);
    return r.data ?? [];
  }
}
