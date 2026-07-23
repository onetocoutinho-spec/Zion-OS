"use client";

// Stage (ENG-003) — recebe um Contexto e renderiza seu conteúdo. Hospeda
// Contextos, nunca funcionalidades (Lei 5). Não conhece Runtime nem domínio:
// o conteúdo vem pronto pelo contrato StageContent. Aceita Contexto vazio.

import { Surface, Text } from "../../design/ui/index.ts";
import { useShell } from "../hooks/useShell.ts";

export function Stage() {
  const { stage, context } = useShell();

  return (
    <Surface level="canvas" as="main" pad="6" style={{ flex: 1, overflow: "auto" }}>
      {stage ? (
        stage.node
      ) : (
        <Text role="body-m" tone="tertiary">
          Contexto “{context.activeId}” sem conteúdo.
        </Text>
      )}
    </Surface>
  );
}
