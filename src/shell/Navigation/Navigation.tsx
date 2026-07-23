"use client";

// Navigation (ENG-003) — renderiza APENAS Contextos. Nenhuma lógica de negócio,
// nenhum domínio. Trocar de Contexto é estado visual (context.setActive).

import { Surface, Text } from "../../design/ui/index.ts";
import { useShell } from "../hooks/useShell.ts";

export function Navigation() {
  const { navigation, context } = useShell();

  return (
    <Surface
      level="raised"
      as="nav"
      pad="3"
      style={{ display: "flex", gap: "var(--fnd-space-2)", flexShrink: 0, alignItems: "center" }}
    >
      {navigation.map((item) => {
        const active = item.id === context.activeId;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => context.setActive(item.id)}
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: "var(--fnd-space-2)" }}
          >
            <Text role="label" tone={active ? "primary" : "tertiary"}>
              {item.label}
            </Text>
          </button>
        );
      })}
    </Surface>
  );
}
