"use client";

// Rota /z (ENG-003) — a superfície do Shell. Renderiza APENAS:
//   Frame → Navigation → Stage → MissionLayer → FeedbackLayer.
// Sem Runtime, sem IA, sem Catálogo, sem domínio. O CSS da slice (Foundation +
// Semantic, namespaced --fnd-/--sem-) é carregado só aqui, nunca no globals.

import "../../design/foundation/foundation.css";
import "../../design/semantic/semantic.css";

import { ShellProvider } from "../../shell/providers/ShellProvider.tsx";
import { Frame } from "../../shell/Frame/Frame.tsx";
import { Navigation } from "../../shell/Navigation/Navigation.tsx";
import { Stage } from "../../shell/Stage/Stage.tsx";
import { MissionLayer } from "../../shell/MissionLayer/MissionLayer.tsx";
import { FeedbackLayer } from "../../shell/FeedbackLayer/FeedbackLayer.tsx";
import type { NavigationItem } from "../../shell/contracts/shell.ts";

// Contextos de navegação (UX-010). São só rótulos de Contexto — nenhum domínio.
const NAV: NavigationItem[] = [
  { id: "hoje", label: "Hoje" },
  { id: "catalogo", label: "Catálogo" },
  { id: "anuncios", label: "Anúncios" },
  { id: "pulso", label: "Pulso" },
  { id: "zion", label: "Zion" },
];

export default function ZPage() {
  return (
    <ShellProvider config={{ navigation: NAV, initialContext: "hoje" }}>
      <Frame>
        <Navigation />
        <Stage />
        <MissionLayer />
        <FeedbackLayer />
      </Frame>
    </ShellProvider>
  );
}
