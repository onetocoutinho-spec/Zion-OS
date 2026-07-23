"use client";

// useShell (ENG-003) — única porta de leitura do estado visual do Shell.
// Expõe context, navigation, mission, feedback (+ stage derivado). NENHUM hook
// do Shell acessa domínio, Capabilities ou AIL — só o contrato ShellContext.

import { useContext } from "react";
import { ShellReactContext } from "../providers/ShellProvider.tsx";
import type { ShellContext } from "../contracts/shell.ts";

export function useShell(): ShellContext {
  const ctx = useContext(ShellReactContext);
  if (!ctx) throw new Error("useShell precisa estar dentro de <ShellProvider>.");
  return ctx;
}
