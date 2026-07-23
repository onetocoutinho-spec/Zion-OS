"use client";

// Frame (ENG-003) — a moldura permanente. Organiza toda a aplicação e cria o
// contexto de posicionamento full-screen. NÃO renderiza conteúdo: só arruma as
// áreas que recebe como filhas. Cego a domínio (Lei 1).

import type { ReactNode } from "react";
import { Surface } from "../../design/ui/index.ts";

export function Frame({ children }: { children: ReactNode }) {
  return (
    <Surface
      level="canvas"
      as="div"
      style={{
        position: "relative",
        width: "100vw",
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
    </Surface>
  );
}
