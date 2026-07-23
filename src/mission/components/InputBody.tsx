"use client";

// InputBody (ENG-004) — entrada estruturada: texto, número ou data. Nunca valida
// domínio; só devolve o valor cru. Estilo 100% por tokens.

import type { ChangeEvent } from "react";
import { fnd } from "../../design/foundation/foundation.generated.ts";
import { sem } from "../../design/semantic/semantic.generated.ts";

export interface InputBodyProps {
  value: string;
  onChange: (value: string) => void;
  inputType: "text" | "number" | "date";
  placeholder?: string;
}

export function InputBody({ value, onChange, inputType, placeholder }: InputBodyProps) {
  return (
    <input
      data-mission-body="input"
      data-autofocus
      type={inputType}
      aria-label="Entrada"
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      style={{
        width: "100%",
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
