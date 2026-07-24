// MissionPort (ENG-005) — porta de ENTRADA. Recebe UserIntent. Nada mais.
// Interface apenas; o Runtime é o adaptador por trás dela.

import type { UserIntent } from "../contracts/runtime.ts";

export interface MissionPort {
  receive(intent: UserIntent): void;
}
