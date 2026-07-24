"use client";

// ShellProvider (ENG-003) — responsável APENAS por estado visual do Shell:
// qual Contexto está ativo, o estado da Missão e o estado de feedback.
// Nunca estado de negócio, nunca domínio, nunca Capabilities, nunca AIL.
// O núcleo de estado (initialShellState/shellReducer) é puro e testável.

import { createContext, useMemo, useReducer, type ReactNode } from "react";
import type {
  ContextId, FeedbackState, MissionState, NavigationItem, ShellContext, StageContent,
} from "../contracts/shell.ts";

/** Configuração injetada por quem hospeda o Shell (contratos, nunca domínio). */
export interface ShellConfig {
  navigation: NavigationItem[];
  contents?: StageContent[];
  initialContext?: ContextId;
  initialMission?: MissionState;
  initialFeedback?: FeedbackState;
}

/** Estado visual interno (não exposto cru). */
export interface ShellVisualState {
  activeId: ContextId;
  mission: MissionState;
  feedback: FeedbackState;
}

export type ShellAction =
  | { type: "setContext"; id: ContextId }
  | { type: "setMission"; mission: MissionState }
  | { type: "setFeedback"; feedback: FeedbackState };

/** Estado inicial puro a partir da config. */
export function initialShellState(config: ShellConfig): ShellVisualState {
  return {
    activeId: config.initialContext ?? config.navigation[0]?.id ?? "",
    mission: config.initialMission ?? { active: false },
    feedback: config.initialFeedback ?? { kind: "idle" },
  };
}

/** Reducer puro — a única transição de estado visual do Shell. */
export function shellReducer(state: ShellVisualState, action: ShellAction): ShellVisualState {
  switch (action.type) {
    case "setContext": return { ...state, activeId: action.id };
    case "setMission": return { ...state, mission: action.mission };
    case "setFeedback": return { ...state, feedback: action.feedback };
    default: return state;
  }
}

export const ShellReactContext = createContext<ShellContext | null>(null);

export function ShellProvider({ config, children }: { config: ShellConfig; children: ReactNode }) {
  const [state, dispatch] = useReducer(shellReducer, config, initialShellState);

  const value = useMemo<ShellContext>(() => {
    const stage = (config.contents ?? []).find((c) => c.contextId === state.activeId) ?? null;
    return {
      context: { activeId: state.activeId, setActive: (id) => dispatch({ type: "setContext", id }) },
      navigation: config.navigation,
      mission: state.mission,
      feedback: state.feedback,
      setFeedback: (feedback) => dispatch({ type: "setFeedback", feedback }),
      stage,
    };
  }, [state, config]);

  return <ShellReactContext.Provider value={value}>{children}</ShellReactContext.Provider>;
}
