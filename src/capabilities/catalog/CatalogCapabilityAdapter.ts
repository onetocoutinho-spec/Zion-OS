// CatalogCapabilityAdapter (ENG-006) — a fronteira de integração (Lei 16).
//
// ÚNICO lugar autorizado a tocar a infraestrutura existente. Reutiliza:
//   • atualizarProduto()  — o serviço REAL (src/lib/services/produtos.ts), sem
//     wrapper, sem alterar assinatura. É o funil que já dispara a AIL/Journal.
//   • DecisionJournal     — o Port da AIL existente (injetável em atualizarProduto).
//   • Produto             — o tipo de domínio existente.
// A captura para a AIL/Journal acontece DENTRO de atualizarProduto (campo
// observado categoriaMarketplace → capturarDecisao). Nada é reimplementado.

import type { CatalogOperation, CatalogPort } from "./CatalogCapability.ts";
import type { CapabilityResponse } from "../../runtime/contracts/runtime.ts";
import { catalogCompleted, catalogFailed } from "./catalog-events.ts";
import { atualizarProduto } from "../../lib/services/produtos.ts";
import type { DecisionJournal } from "../../modules/adaptive-intelligence/decision-journal.ts";
import type { Produto } from "../../lib/types.ts";

/** Assinatura REUTILIZADA de atualizarProduto (a real por padrão; DI para teste). */
type AtualizarProduto = (id: string, dados: Partial<Produto>, journal?: DecisionJournal) => Promise<Produto | null>;

/** Campo de catálogo (abstrato) → propriedade real, já observada, do Produto. */
const PROPRIEDADE: Record<CatalogOperation["campo"], keyof Produto> = {
  categoriaMarketplace: "categoriaMarketplaceSugerida",
};

export class CatalogCapabilityAdapter implements CatalogPort {
  constructor(
    private readonly produtoId: string,
    private readonly journal?: DecisionJournal,
    private readonly atualizar: AtualizarProduto = atualizarProduto,
  ) {}

  async apply(op: CatalogOperation): Promise<CapabilityResponse> {
    const dados = { [PROPRIEDADE[op.campo]]: op.valor } as Partial<Produto>;
    try {
      // Reutiliza o serviço REAL: aqui é onde a AIL/Journal engajam (fire-and-forget).
      const resultado = await this.atualizar(this.produtoId, dados, this.journal);
      return resultado
        ? catalogCompleted({ produtoId: resultado.id, campo: op.campo, valor: op.valor })
        : catalogFailed({ motivo: "produto não encontrado", produtoId: this.produtoId });
    } catch (erro) {
      return catalogFailed({ motivo: erro instanceof Error ? erro.message : String(erro), produtoId: this.produtoId });
    }
  }
}
