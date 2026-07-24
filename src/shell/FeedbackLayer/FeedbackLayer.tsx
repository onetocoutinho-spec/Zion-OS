"use client";

// FeedbackLayer (ENG-003) — pinta Loading, Running, Completed e Error SEM
// conhecer Capabilities (só o contrato FeedbackState). Fica sempre montada e é
// puro overlay: nunca altera o layout (Lei 7).

import { Surface, Text } from "../../design/ui/index.ts";
import { useShell } from "../hooks/useShell.ts";
import type { FeedbackKind } from "../contracts/shell.ts";

const LABEL: Record<FeedbackKind, string> = {
  idle: "",
  loading: "Carregando…",
  running: "Executando…",
  completed: "Concluído",
  error: "Erro",
};

export function FeedbackLayer() {
  const { feedback } = useShell();
  const visible = feedback.kind !== "idle";

  return (
    <div
      data-shell-layer="feedback"
      style={{ position: "fixed", right: 0, bottom: 0, padding: "var(--fnd-space-4)", pointerEvents: "none", zIndex: 200 }}
    >
      {visible ? (
        <Surface level="overlay" radius="md" pad="3" style={{ pointerEvents: "auto" }}>
          <Text role="label" tone={feedback.kind === "error" ? "primary" : "secondary"}>
            {feedback.message ?? LABEL[feedback.kind]}
          </Text>
        </Surface>
      ) : null}
    </div>
  );
}
