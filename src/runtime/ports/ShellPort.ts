// ShellPort (ENG-005) — porta de SAÍDA para a interface. Publica RuntimeEvents.
// Nunca importa React nem conhece componentes (Lei 14). Interface apenas; o
// adaptador concreto (ex.: console.log na /z) é injetado pelo composition root.

import type { RuntimeEvent } from "../contracts/runtime.ts";

export interface ShellPort {
  publish(event: RuntimeEvent): void;
}
