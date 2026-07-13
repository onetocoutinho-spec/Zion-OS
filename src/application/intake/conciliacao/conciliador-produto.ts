// Conciliação de identidade (001 §1): SKU de origem é a chave 1ª; EAN só desempata.
//
// Consulta o Produto Mestre EXCLUSIVAMENTE pelos Ports da Application:
//   1. porSkuOrigem(clienteId, sku)  → casa por SKU (casado_sku)
//   2. senão, se houver EAN: listarDoCliente + find por EAN  → casa por EAN
//      (o Port não tem porEan; usamos a leitura já existente — sem alterar o domínio)
//   3. senão → novo (nenhuma)
// Sem I/O direto, sem banco: tudo através do repositório injetado.

import type { ProdutoMestreRepository } from "../../ports/produto-mestre-repository.ts";
import { SkuOrigem } from "../../../domain/shared/value-objects/sku-origem.ts";
import { comoId } from "../../../domain/shared/value-objects/identificador.ts";
import type { ProdutoMestre } from "../../../domain/produto-mestre/produto-mestre.ts";
import type { IdentidadeCanonicaIntake } from "../types/intake-command.ts";
import type { ChaveConciliacao } from "../types/intake-result.ts";

export interface ResultadoConciliacao {
  readonly chave: ChaveConciliacao;
  readonly existente: ProdutoMestre | null;
}

export class ConciliadorProduto {
  private readonly repo: ProdutoMestreRepository;

  constructor(repo: ProdutoMestreRepository) {
    this.repo = repo;
  }

  async conciliar(
    clienteId: string,
    identidade: IdentidadeCanonicaIntake,
  ): Promise<ResultadoConciliacao> {
    const rSku = SkuOrigem.criar(identidade.skuOrigem);
    if (!rSku.ok) {
      // SKU inválido é barrado pelo validator antes; aqui é só defesa.
      return { chave: "nenhuma", existente: null };
    }

    const cliente = comoId<"cliente">(clienteId);

    // 1ª chave: SKU de origem.
    const porSku = await this.repo.porSkuOrigem(cliente, rSku.valor);
    if (porSku) {
      return { chave: "sku_origem", existente: porSku };
    }

    // Chave complementar: EAN (só quando o SKU não casou).
    if (identidade.ean && identidade.ean.trim() !== "") {
      const ean = identidade.ean.trim();
      const doCliente = await this.repo.listarDoCliente(cliente);
      const porEan = doCliente.find((pm) => pm.ean !== null && pm.ean.valor === ean);
      if (porEan) {
        return { chave: "ean", existente: porEan };
      }
    }

    return { chave: "nenhuma", existente: null };
  }
}
