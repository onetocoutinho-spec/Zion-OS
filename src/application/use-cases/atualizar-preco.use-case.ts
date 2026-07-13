// Use case: Atualizar Preço de venda de uma Variante (Zion é dona — 001 §6).
//
// Busca o agregado, constrói o Dinheiro (VO), delega ao domínio
// (definirPrecoVendaVariante — que versiona e registra eventos), persiste e publica.

import type { ProdutoMestreRepository } from "../ports/produto-mestre-repository.ts";
import type { EventPublisher } from "../ports/event-publisher.ts";
import type { Clock } from "../ports/clock.ts";
import type { Logger } from "../ports/logger.ts";
import type { AtualizarPrecoCommand } from "../commands/atualizar-preco.command.ts";
import type { ProdutoMestreDTO } from "../dto/produto-mestre-dto.ts";
import { type Resultado, ok, falha, erroApp, deDominio } from "../shared/resultado.ts";
import { paraDTO } from "../mappers/produto-mestre-mapper.ts";
import { paraAutor } from "../mappers/autor-mapper.ts";
import { publicarEventos } from "../services/publicacao-de-eventos.ts";
import { comoId } from "../../domain/shared/value-objects/identificador.ts";
import { Dinheiro } from "../../domain/shared/value-objects/dinheiro.ts";

export interface DependenciasAtualizarPreco {
  readonly repo: ProdutoMestreRepository;
  readonly publisher: EventPublisher;
  readonly clock: Clock;
  readonly logger: Logger;
}

export class AtualizarPrecoUseCase {
  private readonly deps: DependenciasAtualizarPreco;

  constructor(deps: DependenciasAtualizarPreco) {
    this.deps = deps;
  }

  async executar(comando: AtualizarPrecoCommand): Promise<Resultado<ProdutoMestreDTO>> {
    const pm = await this.deps.repo.porId(comoId<"produto_mestre">(comando.produtoMestreId));
    if (!pm) return falha(erroApp("nao_encontrado", "Produto Mestre não encontrado."));

    const autor = paraAutor(comando.autor);
    if (!autor.ok) return falha(deDominio(autor.erro));

    const preco = Dinheiro.criar(comando.precoVenda);
    if (!preco.ok) return falha(deDominio(preco.erro));

    const definido = pm.definirPrecoVendaVariante(
      comoId<"variante">(comando.varianteId),
      preco.valor,
      autor.valor,
      this.deps.clock.agora(),
    );
    if (!definido.ok) return falha(deDominio(definido.erro));

    await this.deps.repo.salvar(pm);
    await publicarEventos(this.deps, pm.puxarEventos());

    return ok(paraDTO(pm));
  }
}
