"use client";

// MissionLayer (ENG-003) — renderiza Missões quando existirem. Fica SEMPRE
// montada, mesmo vazia (o container persiste). Aparece ACIMA do Stage (Lei 6).
// Não conhece o significado da Missão — só o estado visual MissionState.

import { Surface, Text } from "../../design/ui/index.ts";
import { useShell } from "../hooks/useShell.ts";

export function MissionLayer() {
  const { mission } = useShell();

  return (
    <div
      data-shell-layer="mission"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: mission.active ? "auto" : "none",
        zIndex: 100,
      }}
    >
      {mission.active ? (
        <Surface level="overlay" radius="lg" pad="5" style={{ margin: "var(--fnd-space-4)", maxWidth: 720, width: "100%" }}>
          {mission.title ? <Text role="title-m">{mission.title}</Text> : null}
          {mission.node}
        </Surface>
      ) : null}
    </div>
  );
}
