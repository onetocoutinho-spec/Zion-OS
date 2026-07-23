// Máquina de estados VISUAIS da Mission (ENG-004) — Functional Core: puro,
// determinístico, sem I/O, sem tempo, sem React. Só transições visuais; nenhum
// estado técnico, nenhum estado de negócio, nenhuma Decision.
//
//   hidden → (OPEN) → appearing → (ACTIVATE) → active → (WAIT) → waiting
//                                                              → (CLOSE) → closing → (CLEAR) → hidden

import type { Mission, MissionPayload, MissionState } from "../contracts/mission.ts";

export interface MissionMachineState {
  payload: MissionPayload | null;
  state: MissionState;
}

export type MissionAction =
  | { type: "OPEN"; payload: MissionPayload }
  | { type: "ACTIVATE" }
  | { type: "WAIT" }
  | { type: "CLOSE" }
  | { type: "CLEAR" };

export const initialMissionState: MissionMachineState = { payload: null, state: "hidden" };

export function missionReducer(state: MissionMachineState, action: MissionAction): MissionMachineState {
  switch (action.type) {
    case "OPEN":
      return { payload: action.payload, state: "appearing" };
    case "ACTIVATE":
      return state.payload ? { ...state, state: "active" } : state;
    case "WAIT":
      return state.payload ? { ...state, state: "waiting" } : state;
    case "CLOSE":
      return state.payload ? { ...state, state: "closing" } : state;
    case "CLEAR":
      return initialMissionState;
    default:
      return state;
  }
}

/** Deriva o contrato Mission do estado da máquina (puro). */
export function toMission(state: MissionMachineState): Mission | null {
  return state.payload ? { payload: state.payload, state: state.state } : null;
}
