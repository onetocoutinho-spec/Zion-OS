"use client";

// AskBody (ENG-004) — pergunta aberta, campo livre. Só apresenta e devolve o
// texto; nunca interpreta a resposta. Estilo 100% por tokens (Foundation/Semantic).

import type { ChangeEvent } from "react";
import { fnd } from "../../design/foundation/foundation.generated.ts";
import { sem } from "../../design/semantic/semantic.generated.ts";

export interface AskBodyProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function AskBody({ value, onChange, placeholder }: AskBodyProps) {
  return (
    <textarea
      data-mission-body="ask"
      aria-label="Resposta"
      rows={3}
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
      style={{
        width: "100%",
        resize: "vertical",
        color: sem("color.text.primary"),
        background: sem("color.surface.default"),
        borderRadius: fnd("radius.md"),
        padding: fnd("space.3"),
        borderStyle: "none",
        fontSize: sem("type.body-m.size"),
        lineHeight: fnd("type.body-m.line-height"),
      }}
    />
  );
}
