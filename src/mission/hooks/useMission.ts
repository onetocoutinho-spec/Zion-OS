"use client";

// useMission (ENG-004) — única porta de acesso à Mission. Expõe EXCLUSIVAMENTE
// mission, open, close, emitIntent, clear. Nenhum hook conhece Runtime,
// Capabilities, AIL ou domínio.

import { useContext } from "react";
import { MissionReactContext, type MissionContextValue } from "../provider/MissionProvider.tsx";

export function useMission(): MissionContextValue {
  const ctx = useContext(MissionReactContext);
  if (!ctx) throw new Error("useMission precisa estar dentro de <MissionProvider>.");
  return ctx;
}
