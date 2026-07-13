// Use case: Criar Produto Mestre.
//
// ORQUESTRAÇÃO apenas (sem regra de negócio):
//   id/agora ← Ports → mapper DTO→Domínio → agregado decide (criarRascunho) →
//   repo.salvar (Port) → publica eventos que o agregado registrou → Domínio→DTO.
// Toda invariante fica em ProdutoMestre.criarRascunho.

import type { ProdutoMestreRepository } from "../ports/produto-mestre-repository.ts";
import type { EventPublisher } from "../ports/event-publisher.ts";
import type { Clock } from "../ports/clock.ts";
import type { IdGenerator } from "../ports/id-generator.ts";
import type { Logger } from "../ports/logger.ts";
import type { CriarProdutoMestreCommand } from "../commands/criar-produto-mestre.command.ts";
import type { ProdutoMestreDTO } from "../dto/produto-mestre-dto.ts";
import { type Resultado, ok, falha, deDominio } from "../shared/resultado.ts";
import { paraDadosCriacao, paraDTO } from "../mappers/produto-mestre-mapper.ts";
import { publicarEventos } from "../services/publicacao-de-eventos.ts";
import { ProdutoMestre } from "../../domain/produto-mestre/produto-mestre.ts";

export interface DependenciasCriarProdutoMestre {
  readonly repo: ProdutoMestreRepository;
  readonly publisher: EventPublisher;
  readonly clock: Clock;
  readonly idGen: IdGenerator;
  readonly logger: Logger;
}

export class CriarProdutoMestreUseCase {
  private readonly deps: DependenciasCriarProdutoMestre;

  constructor(deps: DependenciasCriarProdutoMestre) {
    this.deps = deps;
  }

  async executar(comando: CriarProdutoMestreCommand): Promise<Resultado<ProdutoMestreDTO>> {
    const id = this.deps.idGen.novo();
    const agora = this.deps.clock.agora();

    const dados = paraDadosCriacao(comando, id, agora);
    if (!dados.ok) return falha(deDominio(dados.erro));

    const criado = ProdutoMestre.criarRascunho(dados.valor);
    if (!criado.ok) return falha(deDominio(criado.erro));

    const pm = criado.valor;
    await this.deps.repo.salvar(pm);
    await publicarEventos(this.deps, pm.puxarEventos());
    this.deps.logger.info("produto_mestre criado", { id: pm.id });

    return ok(paraDTO(pm));
  }
}
