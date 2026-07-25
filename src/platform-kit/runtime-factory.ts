// Conveniência de construção do Runtime — Platform v2.
//
// FONTE NORMATIVA ÚNICA: ADR-010 (Composition Root de Integração).
//
// A ADR-010 institui uma conveniência de construção que recebe uma Capability e
// uma porta de publicação de eventos e devolve um Runtime pronto, encapsulando a
// fábrica de decisões, o despachante e o aninhamento entre eles.
//
// Esta conveniência é OPCIONAL: o composition root explícito permanece válido,
// suficiente e suportado. Nenhuma superfície é obrigada a adotá-la.
//
// Este módulo vive FORA das camadas congeladas e não altera nenhum contrato
// existente: Runtime, Mission, Shell, Adaptive Intelligence, Capabilities,
// Adapters e serviços permanecem intocados.
//
// Permanecem EXPLÍCITOS na superfície (ADR-010) e portanto NÃO são tratados aqui:
// a Capability acionada · o ato de envio da intenção ao Runtime · o identificador
// de missão e o payload · os campos `type` e `timestamp` da intenção · a porta de
// publicação de eventos · o Adapter da Capability.

import { Runtime } from "../runtime/Runtime.ts";
import { DecisionFactory } from "../runtime/decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../runtime/dispatcher/RuntimeDispatcher.ts";
import type { CapabilityPort } from "../runtime/ports/CapabilityPort.ts";
import type { ShellPort } from "../runtime/ports/ShellPort.ts";

/**
 * Constrói um Runtime pronto para a Capability informada.
 *
 * `shellPort` é OBRIGATÓRIO: a ADR-010 proíbe fornecer a porta de publicação de
 * eventos por meio de valor implícito. A superfície declara sempre qual porta usa.
 *
 * O envio da intenção permanece a cargo da superfície, por `runtime.receive(...)`.
 */
export function criarRuntime(capability: CapabilityPort, shellPort: ShellPort): Runtime {
  return new Runtime(new DecisionFactory(), new RuntimeDispatcher(capability, shellPort), shellPort);
}
