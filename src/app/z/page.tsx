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

// Composition root (ENG-005/006): o /z é o único que conhece o Runtime e cabla a
// Capability real. Mission e Shell NÃO os conhecem — o UserIntent é roteado aqui.
import { Runtime } from "../../runtime/Runtime.ts";
import { DecisionFactory } from "../../runtime/decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../../runtime/dispatcher/RuntimeDispatcher.ts";
import type { ShellPort } from "../../runtime/ports/ShellPort.ts";
// ENG-006: a Capability REAL substitui a FakeCapability (removida).
import { CatalogCapability } from "../../capabilities/catalog/CatalogCapability.ts";
import { CatalogCapabilityAdapter } from "../../capabilities/catalog/CatalogCapabilityAdapter.ts";
// Journal em-memória: implementação EXISTENTE da AIL (reutilizada), para a demo observar a captura.
import { InMemoryDecisionJournal } from "../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

// ShellPort concreto: publica os RuntimeEvents no console (adaptador de saída).
const runtimeShell: ShellPort = { publish: (e) => console.log("[RuntimeEvent]", e.type, e) };
// Journal injetado (reutiliza o Port da AIL); alvo = um produto-semente existente.
const demoJournal = new InMemoryDecisionJournal();
const DEMO_PRODUTO_ID = "prd-01";
const catalog = new CatalogCapability(new CatalogCapabilityAdapter(DEMO_PRODUTO_ID, demoJournal));
const runtime = new Runtime(new DecisionFactory(), new RuntimeDispatcher(catalog, runtimeShell), runtimeShell);
// Exposto só para a demonstração inspecionar o Journal da AIL no navegador.
if (typeof window !== "undefined") (window as unknown as { __demoJournal?: unknown }).__demoJournal = demoJournal;

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

// Mission fake (o app hospeda; a Mission não conhece domínio). ENG-006: pergunta
// por um campo JÁ OBSERVADO pela AIL (categoriaMarketplace), para o fluxo
// atualizarProduto → AIL → Journal engajar de verdade.
const FAKE: MissionPayload = {
  id: "categoria-marketplace",
  type: "input",
  title: "Em qual categoria do marketplace este produto entra?",
  description: "A Zion registra sua decisão de categoria para aprender com ela.",
  body: { kind: "input", inputType: "text", placeholder: "Ex.: Calçados > Chinelos" },
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
        if (e.type === "UserIntentEmitted" && e.intent) {
          console.log("[UserIntent]", e.intent);
          // Roteia o UserIntent para o Runtime (única camada que produz Decision).
          runtime.receive(e.intent);
        } else {
          console.log("[MissionEvent]", e.type, e.missionId);
        }
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
