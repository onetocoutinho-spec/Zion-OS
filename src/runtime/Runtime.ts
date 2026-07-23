// Runtime (ENG-005) — o primeiro núcleo operacional da Zion. Recebe UserIntent
// (é o adaptador por trás da MissionPort), produz Decision via DecisionFactory,
// publica DecisionCreated e despacha a execução. Só conhece contratos e portas
// (Leis 14/15). Composição pura + DI.

import type { Runtime as RuntimeContract, UserIntent } from "./contracts/runtime.ts";
import type { MissionPort } from "./ports/MissionPort.ts";
import type { ShellPort } from "./ports/ShellPort.ts";
import type { DecisionFactory } from "./decision/DecisionFactory.ts";
import type { RuntimeDispatcher } from "./dispatcher/RuntimeDispatcher.ts";
import { decisionCreated } from "./events/runtime-events.ts";

export class Runtime implements RuntimeContract, MissionPort {
  constructor(
    private readonly factory: DecisionFactory,
    private readonly dispatcher: RuntimeDispatcher,
    private readonly shell: ShellPort,
    private readonly now: () => number = Date.now,
  ) {}

  receive(intent: UserIntent): void {
    const decision = this.factory.create(intent);
    this.shell.publish(decisionCreated(decision, this.now()));
    // Só o que o Runtime decidiu executar segue para o Dispatcher.
    if (decision.type === "execute") void this.dispatcher.dispatch(decision);
  }
}
