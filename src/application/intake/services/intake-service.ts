// Intake Service — orquestra a ingestão de UM produto ou de um LOTE.
//
// No lote: detecta SKU DUPLICADO dentro do próprio lote (mesma sku_origem duas
// vezes → o repetido vira "duplicado", sem reprocessar), delega cada produto ao
// Engine e agrega tudo num relatório de conciliação.
//
// Sem infraestrutura: usa o Engine (que usa só Ports). Não publica eventos.

import { IntakeEngine, type DependenciasIntake } from "../engine/intake-engine.ts";
import type {
  ContextoIntake,
  IntakeCommand,
  IntakeLoteCommand,
} from "../types/intake-command.ts";
import { type IntakeItemResult, itemDuplicado } from "../types/intake-result.ts";
import { construirRelatorio, type IntakeReport } from "../reports/intake-report.ts";

export class IntakeService {
  private readonly engine: IntakeEngine;

  constructor(deps: DependenciasIntake) {
    this.engine = new IntakeEngine(deps);
  }

  /** Ingestão de um único produto. */
  async processarProduto(comando: IntakeCommand): Promise<IntakeItemResult> {
    return this.engine.processar(comando);
  }

  /** Ingestão de um lote → relatório de conciliação (com dedup de SKU no lote). */
  async processarLote(comando: IntakeLoteCommand): Promise<IntakeReport> {
    const contexto = extrairContexto(comando);
    const itens: IntakeItemResult[] = [];
    const vistos = new Set<string>();

    for (const produto of comando.produtos) {
      const sku = produto.identidade?.skuOrigem ?? "";
      const chave = sku.trim().toUpperCase();

      if (chave !== "" && vistos.has(chave)) {
        itens.push(itemDuplicado(sku));
        continue;
      }
      if (chave !== "") vistos.add(chave);

      const item = await this.engine.processar({ ...contexto, produto });
      itens.push(item);
    }

    return construirRelatorio(itens);
  }
}

function extrairContexto(comando: IntakeLoteCommand): ContextoIntake {
  return {
    organizacaoId: comando.organizacaoId,
    clienteId: comando.clienteId,
    origemProdutoId: comando.origemProdutoId,
    origemInterna: comando.origemInterna,
    catalogoId: comando.catalogoId,
    modoOperacao: comando.modoOperacao,
  };
}
