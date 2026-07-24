"use client";

// ConfirmBody (ENG-004) — confirmação simples: Sim, Não, Cancelar. Só dispara o
// handler correspondente; nunca decide o que a resposta significa. Tokens-only.

import { Text } from "../../design/ui/index.ts";
import { fnd } from "../../design/foundation/foundation.generated.ts";
import { sem } from "../../design/semantic/semantic.generated.ts";

export interface ConfirmBodyProps {
  yesLabel?: string;
  noLabel?: string;
  cancelLabel?: string;
  onYes: () => void;
  onNo: () => void;
  onCancel: () => void;
}

function Btn({ label, tone, level, onClick }: { label: string; tone: "primary" | "secondary"; level: "raised" | "default"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ cursor: "pointer", borderStyle: "none", borderRadius: fnd("radius.md"), padding: fnd("space.3"), background: sem(level === "raised" ? "color.surface.raised" : "color.surface.default") }}
    >
      <Text role="label" tone={tone}>{label}</Text>
    </button>
  );
}

export function ConfirmBody({ yesLabel = "Sim", noLabel = "Não", cancelLabel = "Cancelar", onYes, onNo, onCancel }: ConfirmBodyProps) {
  return (
    <div data-mission-body="confirm" style={{ display: "flex", gap: fnd("space.2"), justifyContent: "flex-end" }}>
      <Btn label={cancelLabel} tone="secondary" level="default" onClick={onCancel} />
      <Btn label={noLabel} tone="secondary" level="default" onClick={onNo} />
      <Btn label={yesLabel} tone="primary" level="raised" onClick={onYes} />
    </div>
  );
}
