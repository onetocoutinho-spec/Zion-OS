"use client";

// Rota /z (ENG-003/004/005/006/007) — o composition root da Vertical Slice.
// Resolve a fonte de dados REAL (produção autenticada com RLS, ou demonstração
// com produtos-semente oficiais quando não há Supabase/sessão) e cabla:
//   ProductFlow → Mission → UserIntent → Runtime → Decision → CatalogCapability
//   → CatalogCapabilityAdapter → atualizarProduto() → AIL → Journal →
//   RuntimeEvents → (ShellPort) → FeedbackLayer.
// A diferença auth/demo existe SÓ aqui (resolução da fonte). Runtime, Mission,
// Shell, Capability, AIL e Journal são idênticos nos dois modos. Sem console.log,
// sem IDs fake, sem mocks.

import "../../design/foundation/foundation.css";
import "../../design/semantic/semantic.css";

import { useEffect, useRef, useState, type MutableRefObject } from "react";

import { ShellProvider } from "../../shell/providers/ShellProvider.tsx";
import { Frame } from "../../shell/Frame/Frame.tsx";
import { Navigation } from "../../shell/Navigation/Navigation.tsx";
import { Stage } from "../../shell/Stage/Stage.tsx";
import { MissionLayer } from "../../shell/MissionLayer/MissionLayer.tsx";
import { FeedbackLayer } from "../../shell/FeedbackLayer/FeedbackLayer.tsx";
import { useShell } from "../../shell/hooks/useShell.ts";
import type { NavigationItem } from "../../shell/contracts/shell.ts";

import { MissionProvider } from "../../mission/provider/MissionProvider.tsx";
import { Mission } from "../../mission/components/Mission.tsx";
import { useMission } from "../../mission/hooks/useMission.ts";
import type { MissionPayload } from "../../mission/contracts/mission.ts";

import { Runtime } from "../../runtime/Runtime.ts";
import { criarRuntime } from "../../platform-kit/runtime-factory.ts";
import type { ShellPort } from "../../runtime/ports/ShellPort.ts";
import { CatalogCapability } from "../../capabilities/catalog/CatalogCapability.ts";
import { CatalogCapabilityAdapter } from "../../capabilities/catalog/CatalogCapabilityAdapter.ts";

import { meuPerfil } from "../../lib/services/perfil.ts";
import { listarProdutos, listarProdutosDoCliente } from "../../lib/services/produtos.ts";
import { supabaseConfigurado } from "../../lib/supabase/client.ts";
import type { Produto } from "../../lib/types.ts";

import { mapRuntimeEventToFeedback } from "./runtime-feedback.ts";
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

// A Missão de catálogo para um produto real. Campo observado pela AIL (ENG-006).
const missaoCategoria = (produto: Produto): MissionPayload => ({
  id: "categoria-marketplace",
  type: "input",
  title: "Em qual categoria do marketplace este produto entra?",
  description: `Definindo a categoria de “${produto.nome}”. A Zion registra sua decisão para aprender.`,
  body: { kind: "input", inputType: "text", placeholder: "Ex.: Calçados > Chinelos" },
  confirmLabel: "Confirmar",
  cancelLabel: "Cancelar",
});

// ── Seletor de Produto real + wiring do Runtime por produto selecionado ──────
function ProductFlow({ runtimeRef }: { runtimeRef: MutableRefObject<Runtime | null> }) {
  const { setFeedback } = useShell();
  const { open } = useMission();
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [modo, setModo] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      // Resolução da fonte REAL: com sessão de cliente, os produtos do cliente;
      // senão, todos (RLS em produção; sementes oficiais em demonstração).
      const perfil = await meuPerfil();
      const lista = perfil?.clienteId ? await listarProdutosDoCliente(perfil.clienteId) : await listarProdutos();
      if (!vivo) return;
      setModo(supabaseConfigurado ? "autenticado" : "demonstração");
      setProdutos(lista);
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, []);

  const selecionar = (produto: Produto) => {
    // Composition root: constrói o Runtime para ESTE produto real. A ShellPort
    // traduz RuntimeEvents em feedback visual (o Runtime nunca toca React).
    const shellPort: ShellPort = { publish: (e) => setFeedback(mapRuntimeEventToFeedback(e)) };
    const catalog = new CatalogCapability(new CatalogCapabilityAdapter(produto.id));
    runtimeRef.current = criarRuntime(catalog, shellPort);
    open(missaoCategoria(produto));
  };

  if (carregando) return <Text role="body-m" tone="tertiary">Carregando produtos…</Text>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: fnd("space.3"), maxWidth: 560 }}>
      <Text role="title-s" tone="primary">Selecione um produto ({modo})</Text>
      {produtos.length === 0 ? (
        <Text role="body-m" tone="tertiary">Nenhum produto disponível para esta identidade.</Text>
      ) : null}
      {produtos.map((p) => (
        <button
          key={p.id}
          type="button"
          data-produto-id={p.id}
          onClick={() => selecionar(p)}
          style={{ textAlign: "left", cursor: "pointer", borderStyle: "none", borderRadius: fnd("radius.md"), padding: fnd("space.3"), background: sem("color.surface.raised") }}
        >
          <Text role="body-m" tone="primary">{p.nome}</Text>
        </button>
      ))}
    </div>
  );
}

export default function ZPage() {
  const runtimeRef = useRef<Runtime | null>(null);
  return (
    <MissionProvider
      onEvent={(e) => {
        // Roteia o UserIntent para o Runtime do produto selecionado (por porta).
        if (e.type === "UserIntentEmitted" && e.intent) runtimeRef.current?.receive(e.intent);
      }}
    >
      <ShellProvider config={{ navigation: NAV, initialContext: "catalogo", contents: [{ contextId: "catalogo", node: <ProductFlow runtimeRef={runtimeRef} /> }] }}>
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
