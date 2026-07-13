// Use case: Registrar Eventos de Domínio.
//
// Recebe os eventos que um agregado registrou (puxarEventos) e os entrega ao
// EventPublisher (Port), com log. É o ponto único de "preparação de publicação"
// exposto como caso de uso — os demais use cases usam o mesmo serviço interno.
// Sem Event Bus (PR-004); sem regra de negócio.

import type { EventoDominio } from "../../domain/shared/evento-dominio.ts";
import type { EventPublisher } from "../ports/event-publisher.ts";
import type { Logger } from "../ports/logger.ts";
import { publicarEventos } from "../services/publicacao-de-eventos.ts";

export interface DependenciasRegistrarEventos {
  readonly publisher: EventPublisher;
  readonly logger: Logger;
}

export class RegistrarEventosDeDominioUseCase {
  private readonly deps: DependenciasRegistrarEventos;

  constructor(deps: DependenciasRegistrarEventos) {
    this.deps = deps;
  }

  async executar(eventos: ReadonlyArray<EventoDominio>): Promise<void> {
    await publicarEventos(this.deps, eventos);
  }
}
