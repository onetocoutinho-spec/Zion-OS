// Eventos da Mission (ENG-004) — objetos simples + fábricas PURAS.
// Sem EventBus, sem Runtime. A publicação é uma PORTA injetada (MissionEventListener):
// quem hospeda a Mission decide o que fazer com o evento (na /z, um console.log).
//
// Os cinco eventos previstos pela Constituição:
//   MissionOpened · MissionClosed · MissionCancelled · MissionCompleted · UserIntentEmitted

import type { UserIntent, UserIntentType } from "../contracts/mission.ts";

export type MissionEventType =
  | "MissionOpened"
  | "MissionClosed"
  | "MissionCancelled"
  | "MissionCompleted"
  | "UserIntentEmitted";

export interface MissionEvent {
  type: MissionEventType;
  missionId: string;
  timestamp: number;
  /** Presente em UserIntentEmitted e MissionCompleted. */
  intent?: UserIntent;
}

/** Porta de saída (Ports & Adapters). Injeta-se um ouvinte; nunca um EventBus. */
export type MissionEventListener = (event: MissionEvent) => void;

/** Construtor puro do único artefato de saída da interface (Lei 13). */
export function createUserIntent(
  missionId: string,
  type: UserIntentType,
  payload: unknown,
  timestamp: number,
): UserIntent {
  return { missionId, type, payload, timestamp };
}

export const missionOpened = (missionId: string, timestamp: number): MissionEvent => ({
  type: "MissionOpened", missionId, timestamp,
});
export const missionClosed = (missionId: string, timestamp: number): MissionEvent => ({
  type: "MissionClosed", missionId, timestamp,
});
export const missionCancelled = (missionId: string, timestamp: number): MissionEvent => ({
  type: "MissionCancelled", missionId, timestamp,
});
export const missionCompleted = (intent: UserIntent): MissionEvent => ({
  type: "MissionCompleted", missionId: intent.missionId, timestamp: intent.timestamp, intent,
});
export const userIntentEmitted = (intent: UserIntent): MissionEvent => ({
  type: "UserIntentEmitted", missionId: intent.missionId, timestamp: intent.timestamp, intent,
});
