"use client";

// Rota /z (ENG-003 + ENG-004) — a superfície do Shell + o fluxo humano da Mission.
// Renderiza APENAS Shell (Frame→Navigation→Stage→MissionLayer→FeedbackLayer) e a
// Mission. Sem Runtime, sem IA, sem Catálogo, sem domínio. O CSS da slice
// (Foundation + Semantic, namespaced) é carregado só aqui.

import "../../design/foundation/foundation.css";
import "../../design/semantic/semantic.css";

import { ShellProvider } from "../../shell/providers/ShellProvider.tsx";
import { Frame } from "../../shell/Frame/Frame.tsx";
import { Navigation } from "../../shell/Navigation/Navigation.tsx";
import { Stage } from "../../shell/Stage/Stage.tsx";
import { MissionLayer } from "../../shell/MissionLayer/MissionLayer.tsx";
import { FeedbackLayer } from "../../shell/FeedbackLayer/FeedbackLayer.tsx";
import type { NavigationItem } from "../../shell/contracts/shell.ts";

import { MissionProvider } from "../../mission/provider/MissionProvider.tsx";
import { Mission } from "../../mission/components/Mission.tsx";
import { useMission } from "../../mission/hooks/useMission.ts";
import type { MissionPayload } from "../../mission/contracts/mission.ts";

import { Text } from "../../design/ui/index.ts";
import { fnd } from "../../design/foundation/foundation.generated.ts";
import { sem } from "../../design/semantic/semantic.generated.ts";

const NAV: NavigationItem[] = [
  { id: "hoje", label: "Hoje" },
  { id: "catalogo", label: "Catálogo" },
  { id: "anuncios", label: "Anúncios" },
  { id: "pulso", label: "Pulso" },
  { id: "zion", label: "Zion" },
];

// Mission fake (o app hospeda; a Mission não conhece domínio). Exemplo do ENG-004.
const FAKE: MissionPayload = {
  id: "codigo-de-barras",
  type: "input",
  title: "Qual é o código de barras?",
  description: "Precisamos desta informação para concluir o cadastro.",
  body: { kind: "input", inputType: "text", placeholder: "Ex.: 7891234567890" },
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
};

function MissionTrigger() {
  const { open } = useMission();
  return (
    <button
      type="button"
      data-testid="abrir-missao"
      onClick={() => open(FAKE)}
      style={{ cursor: "pointer", borderStyle: "none", borderRadius: fnd("radius.md"), padding: fnd("space.3"), background: sem("color.surface.raised") }}
    >
      <Text role="label" tone="primary">Abrir Missão (exemplo)</Text>
    </button>
  );
}

export default function ZPage() {
  return (
    <MissionProvider
      onEvent={(e) => {
        if (e.type === "UserIntentEmitted") console.log("[UserIntent]", e.intent);
        else console.log("[MissionEvent]", e.type, e.missionId);
      }}
    >
      <ShellProvider config={{ navigation: NAV, initialContext: "hoje", contents: [{ contextId: "hoje", node: <MissionTrigger /> }] }}>
        <Frame>
          <Navigation />
          <Stage />
          <MissionLayer />
          <Mission />
          <FeedbackLayer />
        </Frame>
      </ShellProvider>
    </MissionProvider>
  );
}
