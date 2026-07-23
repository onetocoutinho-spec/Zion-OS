// Contratos da Mission (ENG-004) — SÓ interfaces. Nenhuma implementação, nenhum
// helper. Toda comunicação Humano↔Sistema passa por estes tipos.
//
// A Mission NUNCA produz Decision (Lei 13). Ela só apresenta uma necessidade e
// captura a intenção do usuário como UserIntent. Estes contratos não conhecem
// Runtime, Capabilities, AIL nem domínio.

/** As quatro naturezas de interação que a Mission sabe apresentar. */
export type MissionType = "ask" | "choice" | "confirm" | "input";

/** Estados VISUAIS da Mission (nenhum estado técnico ou de negócio). */
export type MissionState = "hidden" | "appearing" | "active" | "waiting" | "closing";

/** As únicas intenções que um humano pode emitir. Nunca uma Decision. */
export type UserIntentType = "answer" | "confirm" | "cancel";

export interface ChoiceOption {
  id: string;
  label: string;
}

export interface AskBodyContract {
  kind: "ask";
  placeholder?: string;
}
export interface ChoiceBodyContract {
  kind: "choice";
  options: ChoiceOption[];
}
export interface ConfirmBodyContract {
  kind: "confirm";
  yesLabel?: string;
  noLabel?: string;
}
export interface InputBodyContract {
  kind: "input";
  inputType: "text" | "number" | "date";
  placeholder?: string;
}

/** O corpo da Mission — descreve o que apresentar, nunca como decidir. */
export type MissionBody =
  | AskBodyContract
  | ChoiceBodyContract
  | ConfirmBodyContract
  | InputBodyContract;

/** A necessidade apresentada ao humano. Injetada por quem hospeda a Mission. */
export interface MissionPayload {
  id: string;
  type: MissionType;
  title: string;
  description?: string;
  body: MissionBody;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** O evento puro que a interface produz — o ÚNICO artefato de saída (Lei 13). */
export interface UserIntent {
  missionId: string;
  type: UserIntentType;
  payload: unknown;
  timestamp: number;
}

/** O resultado de uma Mission = a intenção capturada (nunca uma Decision). */
export interface MissionResult {
  intent: UserIntent;
}

/** A Mission viva = a necessidade apresentada + seu estado visual corrente. */
export interface Mission {
  payload: MissionPayload;
  state: MissionState;
}
