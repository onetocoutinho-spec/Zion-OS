// Use case: Adicionar Variante a um Produto Mestre.
//
// id ← Port → mapper DTO→Domínio (VOs) → Variante.criar (domínio) →
// pm.adicionarVariante (domínio garante pertencimento/unicidade) → salvar → DTO.

import type { ProdutoMestreRepository } from "../ports/produto-mestre-repository.ts";
import type { EventPublisher } from "../ports/event-publisher.ts";
import type { IdGenerator } from "../ports/id-generator.ts";
import type { Logger } from "../ports/logger.ts";
import type { AdicionarVarianteCommand } from "../commands/adicionar-variante.command.ts";
import type { ProdutoMestreDTO } from "../dto/produto-mestre-dto.ts";
import { type Resultado, ok, falha, erroApp, deDominio } from "../shared/resultado.ts";
import { paraDadosVariante, paraDTO } from "../mappers/produto-mestre-mapper.ts";
import { publicarEventos } from "../services/publicacao-de-eventos.ts";
import { comoId } from "../../domain/shared/value-objects/identificador.ts";
import { Variante } from "../../domain/produto-mestre/variante.ts";

export interface DependenciasAdicionarVariante {
  readonly repo: ProdutoMestreRepository;
  readonly publisher: EventPublisher;
  readonly idGen: IdGenerator;
  readonly logger: Logger;
}

export class AdicionarVarianteUseCase {
  private readonly deps: DependenciasAdicionarVariante;

  constructor(deps: DependenciasAdicionarVariante) {
    this.deps = deps;
  }

  async executar(comando: AdicionarVarianteCommand): Promise<Resultado<ProdutoMestreDTO>> {
    const pm = await this.deps.repo.porId(comoId<"produto_mestre">(comando.produtoMestreId));
    if (!pm) return falha(erroApp("nao_encontrado", "Produto Mestre não encontrado."));

    const dados = paraDadosVariante(comando, this.deps.idGen.novo());
    if (!dados.ok) return falha(deDominio(dados.erro));

    const variante = Variante.criar(dados.valor);
    if (!variante.ok) return falha(deDominio(variante.erro));

    const adicionada = pm.adicionarVariante(variante.valor);
    if (!adicionada.ok) return falha(deDominio(adicionada.erro));

    await this.deps.repo.salvar(pm);
    await publicarEventos(this.deps, pm.puxarEventos());

    return ok(paraDTO(pm));
  }
}
