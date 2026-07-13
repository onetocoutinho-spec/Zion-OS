// Port: EventPublisher.
//
// A Application "prepara a publicação" dos eventos que o agregado registrou
// (puxarEventos), entregando-os a este Port. NÃO é o Event Bus (PR-004): aqui é
// só o contrato. A implementação (outbox/bus) é de Infra, num PR futuro.

import type { EventoDominio } from "../../domain/shared/evento-dominio.ts";

export interface EventPublisher {
  publicar(eventos: ReadonlyArray<EventoDominio>): Promise<void>;
}
