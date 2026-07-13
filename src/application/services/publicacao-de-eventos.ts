// Serviço de aplicação: "preparar a publicação" dos eventos de domínio.
//
// Entrega ao EventPublisher (Port) os eventos que o agregado registrou. NÃO é o
// Event Bus (PR-004): aqui é só orquestração. Reutilizado por todos os use cases.
// Nada de negócio; nada de infra.

import type { EventoDominio } from "../../domain/shared/evento-dominio.ts";
import type { EventPublisher } from "../ports/event-publisher.ts";
import type { Logger } from "../ports/logger.ts";

export interface DependenciasPublicacao {
  readonly publisher: EventPublisher;
  readonly logger: Logger;
}

export async function publicarEventos(
  deps: DependenciasPublicacao,
  eventos: ReadonlyArray<EventoDominio>,
): Promise<void> {
  if (eventos.length === 0) return;
  await deps.publisher.publicar(eventos);
  deps.logger.info("eventos de domínio publicados", {
    total: eventos.length,
    tipos: eventos.map((e) => e.tipo),
  });
}
