// Use case: Atualizar Produto Mestre (conteúdo).
//
// Busca o agregado pelo Port, delega a edição/versionamento ao domínio
// (editarConteudo — inclui a regra F4), persiste e publica os eventos.

import type { ProdutoMestreRepository } from "../ports/produto-mestre-repository.ts";
import type { EventPublisher } from "../ports/event-publisher.ts";
import type { Clock } from "../ports/clock.ts";
import type { Logger } from "../ports/logger.ts";
import type { AtualizarProdutoMestreCommand } from "../commands/atualizar-produto-mestre.command.ts";
import type { ProdutoMestreDTO } from "../dto/produto-mestre-dto.ts";
import { type Resultado, ok, falha, erroApp, deDominio } from "../shared/resultado.ts";
import { paraDTO } from "../mappers/produto-mestre-mapper.ts";
import { paraAutor } from "../mappers/autor-mapper.ts";
import { publicarEventos } from "../services/publicacao-de-eventos.ts";
import { comoId } from "../../domain/shared/value-objects/identificador.ts";

export interface DependenciasAtualizarProdutoMestre {
  readonly repo: ProdutoMestreRepository;
  readonly publisher: EventPublisher;
  readonly clock: Clock;
  readonly logger: Logger;
}

export class AtualizarProdutoMestreUseCase {
  private readonly deps: DependenciasAtualizarProdutoMestre;

  constructor(deps: DependenciasAtualizarProdutoMestre) {
    this.deps = deps;
  }

  async executar(comando: AtualizarProdutoMestreCommand): Promise<Resultado<ProdutoMestreDTO>> {
    const pm = await this.deps.repo.porId(comoId<"produto_mestre">(comando.produtoMestreId));
    if (!pm) return falha(erroApp("nao_encontrado", "Produto Mestre não encontrado."));

    const autor = paraAutor(comando.autor);
    if (!autor.ok) return falha(deDominio(autor.erro));

    const editado = pm.editarConteudo(comando.patch, autor.valor, this.deps.clock.agora());
    if (!editado.ok) return falha(deDominio(editado.erro));

    await this.deps.repo.salvar(pm);
    await publicarEventos(this.deps, pm.puxarEventos());

    return ok(paraDTO(pm));
  }
}
