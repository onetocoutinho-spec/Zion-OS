"use client";

// MissionProvider (ENG-004) — Imperative Shell. Responsável APENAS pelo estado
// VISUAL da Mission (a máquina hidden→…→closing do reducer puro). Nunca estado
// técnico, nunca de negócio. Não conhece Runtime, Capabilities, AIL nem domínio.
//
// Portas injetadas (Dependency Injection / Ports & Adapters):
//   • onEvent — publica MissionEvent (sem EventBus). Na /z: console.log.
//   • now     — relógio (testabilidade). Default Date.now.
//
// A transição temporizada (appearing→active→waiting e closing→hidden) usa os
// tokens de movimento da Foundation — nenhum tempo literal.

import { createContext, useCallback, useEffect, useMemo, useReducer, type ReactNode } from "react";
import type { Mission, MissionPayload, UserIntent, UserIntentType } from "../contracts/mission.ts";
import { initialMissionState, missionReducer, toMission } from "./mission-reducer.ts";
import {
  createUserIntent, missionOpened, missionClosed, missionCancelled, missionCompleted, userIntentEmitted,
  type MissionEvent, type MissionEventListener,
} from "../events/mission-events.ts";
import { foundation } from "../../design/foundation/foundation.generated.ts";

const ms = (token: keyof typeof foundation.Motion) => parseInt(String(foundation.Motion[token]), 10) || 0;
const ENTER_MS = ms("motion.duration.standard"); // active → waiting
const EXIT_MS = ms("motion.duration.standard"); // closing → hidden
const TICK_MS = ms("motion.duration.instant"); // appearing → active (próximo tique: dispara a transição CSS)

export interface MissionContextValue {
  mission: Mission | null;
  open: (payload: MissionPayload) => void;
  close: () => void;
  emitIntent: (type: UserIntentType, payload: unknown) => UserIntent;
  clear: () => void;
}

export const MissionReactContext = createContext<MissionContextValue | null>(null);

export interface MissionProviderProps {
  children: ReactNode;
  onEvent?: MissionEventListener;
  now?: () => number;
}

export function MissionProvider({ children, onEvent, now = Date.now }: MissionProviderProps) {
  const [machine, dispatch] = useReducer(missionReducer, initialMissionState);
  const emit = useCallback((e: MissionEvent) => onEvent?.(e), [onEvent]);

  // Transições visuais temporizadas (a única fonte da verdade do estado visual).
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (machine.state === "appearing") t = setTimeout(() => dispatch({ type: "ACTIVATE" }), TICK_MS);
    else if (machine.state === "active") t = setTimeout(() => dispatch({ type: "WAIT" }), ENTER_MS);
    else if (machine.state === "closing") t = setTimeout(() => dispatch({ type: "CLEAR" }), EXIT_MS);
    return () => clearTimeout(t);
  }, [machine.state]);

  const open = useCallback((payload: MissionPayload) => {
    dispatch({ type: "OPEN", payload });
    emit(missionOpened(payload.id, now()));
  }, [emit, now]);

  const clear = useCallback(() => dispatch({ type: "CLEAR" }), []);

  const close = useCallback(() => {
    const id = machine.payload?.id;
    if (!id) return;
    dispatch({ type: "CLOSE" });
    emit(missionClosed(id, now()));
  }, [emit, now, machine.payload]);

  // A interface produz EXCLUSIVAMENTE UserIntent (Lei 13). Publica os eventos e fecha.
  const emitIntent = useCallback((type: UserIntentType, payload: unknown): UserIntent => {
    const id = machine.payload?.id ?? "";
    const intent = createUserIntent(id, type, payload, now());
    emit(userIntentEmitted(intent));
    emit(type === "cancel" ? missionCancelled(id, intent.timestamp) : missionCompleted(intent));
    dispatch({ type: "CLOSE" });
    emit(missionClosed(id, now()));
    return intent;
  }, [emit, now, machine.payload]);

  const value = useMemo<MissionContextValue>(
    () => ({ mission: toMission(machine), open, close, emitIntent, clear }),
    [machine, open, close, emitIntent, clear],
  );

  return <MissionReactContext.Provider value={value}>{children}</MissionReactContext.Provider>;
}
