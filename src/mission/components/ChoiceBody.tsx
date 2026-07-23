"use client";

// ChoiceBody (ENG-004) — escolha entre alternativas. NUNCA interpreta respostas:
// só marca qual id foi selecionado e devolve. Estilo 100% por tokens.

import { Text } from "../../design/ui/index.ts";
import { fnd } from "../../design/foundation/foundation.generated.ts";
import { sem } from "../../design/semantic/semantic.generated.ts";
import type { ChoiceOption } from "../contracts/mission.ts";

export interface ChoiceBodyProps {
  options: ChoiceOption[];
  value: string | null;
  onSelect: (id: string) => void;
}

export function ChoiceBody({ options, value, onSelect }: ChoiceBodyProps) {
  return (
    <div data-mission-body="choice" role="radiogroup" style={{ display: "flex", flexDirection: "column", gap: fnd("space.2") }}>
      {options.map((opt) => {
        const selected = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSelect(opt.id)}
            style={{
              textAlign: "left",
              cursor: "pointer",
              borderStyle: "none",
              borderRadius: fnd("radius.md"),
              padding: fnd("space.3"),
              background: selected ? sem("color.surface.raised") : sem("color.surface.default"),
            }}
          >
            <Text role="body-m" tone={selected ? "primary" : "secondary"}>{opt.label}</Text>
          </button>
        );
      })}
    </div>
  );
}
