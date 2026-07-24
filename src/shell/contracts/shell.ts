// Contratos do Shell (ENG-003). SÓ interfaces — nenhuma implementação.
// Toda comunicação entre áreas do Shell ocorre por estes tipos (Lei 4).
// Nenhum tipo aqui conhece domínio, Capabilities ou AIL.

import type { ReactNode } from "react";

/** Identificador de um Contexto (área) que o Stage pode hospedar. */
export type ContextId = string;

/** Um item de navegação = um Contexto oferecido. Sem lógica, sem domínio. */
export interface NavigationItem {
  id: ContextId;
  label: string;
}

/** Conteúdo que o Stage renderiza para um Contexto. O Shell não o produz. */
export interface StageContent {
  contextId: ContextId;
  node: ReactNode;
}

/** Estado visual da Missão. O Shell não conhece o que a Missão significa. */
export interface MissionState {
  active: boolean;
  title?: string;
  node?: ReactNode;
}

/** Espécies de feedback que o FeedbackLayer sabe pintar — sem conhecer origem. */
export type FeedbackKind = "idle" | "loading" | "running" | "completed" | "error";

/** Estado visual de feedback (overlay). Nunca altera layout (Lei 7). */
export interface FeedbackState {
  kind: FeedbackKind;
  message?: string;
}

/** A forma que useShell() expõe: só estado visual, nunca de negócio. */
export interface ShellContext {
  context: { activeId: ContextId; setActive: (id: ContextId) => void };
  navigation: NavigationItem[];
  mission: MissionState;
  feedback: FeedbackState;
  /** Empurra um estado de feedback visual (simétrico a setActive). O Shell não
   *  conhece a ORIGEM do feedback — quem publica (ex.: uma ShellPort) traduz. */
  setFeedback: (feedback: FeedbackState) => void;
  stage: StageContent | null;
}
