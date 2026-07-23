"use client";

// Mission (ENG-004) — a interação humana. Recebe um contrato (MissionPayload via
// provider), renderiza, captura a intenção, publica UserIntent e fecha. NUNCA
// executa lógica, decide, ou conhece Runtime/Capabilities/AIL/domínio (Lei 13).
// Acessibilidade: role=dialog, focus trap, Escape cancela, Enter confirma, Tab
// navega, foco restaurado. Estilo 100% por tokens (Foundation/Semantic/Primitive).

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Surface, Text } from "../../design/ui/index.ts";
import { fnd } from "../../design/foundation/foundation.generated.ts";
import { sem } from "../../design/semantic/semantic.generated.ts";
import { useMission } from "../hooks/useMission.ts";
import { AskBody } from "./AskBody.tsx";
import { ChoiceBody } from "./ChoiceBody.tsx";
import { ConfirmBody } from "./ConfirmBody.tsx";
import { InputBody } from "./InputBody.tsx";
import type { UserIntentType } from "../contracts/mission.ts";

const FOCUSABLE = 'input, textarea, select, button, [href], [tabindex]:not([tabindex="-1"])';

function focusables(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.hasAttribute("disabled"));
}

function FooterButton({ label, tone, level, onClick }: { label: string; tone: "primary" | "secondary"; level: "raised" | "default"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ cursor: "pointer", borderStyle: "none", borderRadius: fnd("radius.md"), padding: fnd("space.3"), background: sem(level === "raised" ? "color.surface.raised" : "color.surface.default") }}
    >
      <Text role="label" tone={tone}>{label}</Text>
    </button>
  );
}

export function Mission() {
  const { mission, emitIntent } = useMission();
  const [value, setValue] = useState<string>("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);

  // Reinicia o valor a cada nova Mission.
  useEffect(() => { setValue(""); }, [mission?.payload.id]);

  // Foco: captura + autofoco ao aparecer.
  useEffect(() => {
    if (mission?.state === "appearing" && dialogRef.current) {
      lastFocused.current = (document.activeElement as HTMLElement) ?? null;
      const el = dialogRef.current.querySelector<HTMLElement>("[data-autofocus]") ?? focusables(dialogRef.current)[0];
      el?.focus();
    }
  }, [mission?.state]);

  // Restauração de foco ao fechar.
  useEffect(() => {
    if (!mission && lastFocused.current) { lastFocused.current.focus?.(); lastFocused.current = null; }
  }, [mission]);

  if (!mission || mission.state === "hidden") return null;

  const p = mission.payload;
  const shown = mission.state === "active" || mission.state === "waiting";
  const answerType: UserIntentType = p.type === "confirm" ? "confirm" : "answer";
  const confirm = () => emitIntent(answerType, value);
  const cancel = () => emitIntent("cancel", null);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); return; }
    if (e.key === "Enter" && (p.type === "input" || p.type === "choice")) { e.preventDefault(); confirm(); return; }
    if (e.key === "Enter" && p.type === "confirm") { e.preventDefault(); emitIntent("confirm", true); return; }
    if (e.key === "Tab") {
      const items = focusables(dialogRef.current);
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const titleId = `mission-title-${p.id}`;
  const descId = p.description ? `mission-desc-${p.id}` : undefined;

  return (
    <div
      data-mission-plane
      style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: shown ? "auto" : "none" }}
    >
      {/* Scrim (token-based, sem cor literal) */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, background: `color-mix(in srgb, ${fnd("base.950")} 64%, transparent)`, opacity: shown ? 1 : 0, transition: `opacity var(--fnd-motion-duration-standard)` }}
      />
      {/* Diálogo */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        onKeyDown={onKeyDown}
        style={{ position: "relative", opacity: shown ? 1 : 0, transform: shown ? "translateY(0)" : `translateY(${fnd("space.2")})`, transition: `opacity var(--fnd-motion-duration-standard), transform var(--fnd-motion-duration-standard)` }}
      >
        <Surface level="overlay" radius="lg" pad="5" style={{ width: "min(92vw, 560px)", display: "flex", flexDirection: "column", gap: fnd("space.4") }}>
          <div style={{ display: "flex", flexDirection: "column", gap: fnd("space.2") }}>
            <Text as="h2" role="title-m" tone="primary" style={{ margin: "0" }}>
              <span id={titleId}>{p.title}</span>
            </Text>
            {p.description ? (
              <Text as="p" role="body-s" tone="secondary" style={{ margin: "0" }}>
                <span id={descId}>{p.description}</span>
              </Text>
            ) : null}
          </div>

          {p.type === "ask" && p.body.kind === "ask" ? <AskBody value={value} onChange={setValue} placeholder={p.body.placeholder} /> : null}
          {p.type === "input" && p.body.kind === "input" ? <InputBody value={value} onChange={setValue} inputType={p.body.inputType} placeholder={p.body.placeholder} /> : null}
          {p.type === "choice" && p.body.kind === "choice" ? <ChoiceBody options={p.body.options} value={value || null} onSelect={setValue} /> : null}
          {p.type === "confirm" && p.body.kind === "confirm" ? (
            <ConfirmBody
              yesLabel={p.body.yesLabel}
              noLabel={p.body.noLabel}
              cancelLabel={p.cancelLabel}
              onYes={() => emitIntent("confirm", true)}
              onNo={() => emitIntent("confirm", false)}
              onCancel={cancel}
            />
          ) : (
            <div style={{ display: "flex", gap: fnd("space.2"), justifyContent: "flex-end" }}>
              <FooterButton label={p.cancelLabel ?? "Cancelar"} tone="secondary" level="default" onClick={cancel} />
              <FooterButton label={p.confirmLabel ?? "Confirmar"} tone="primary" level="raised" onClick={confirm} />
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}
