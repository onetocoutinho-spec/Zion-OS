// Testes dos primitivos (ENG-002 Etapa 2) — provam a LEI ratificada:
// decisão contextual (cor, superfície, size/weight) → Semantic (--sem-*);
// métrica invariante (line-height, radius, padding) → Foundation (--fnd-*).
// Rodar: npx tsx --test src/design/ui/ui.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { textStyle } from "./text-style.ts";
import { surfaceStyle } from "./surface-style.ts";
import { semanticRoles, type SemanticRole } from "../semantic/semantic.generated.ts";

test("Text: cor e size/weight vêm da Semantic; line-height vem da Foundation", () => {
  const s = textStyle("title-l", "secondary");
  assert.equal(s.fontSize, "var(--sem-type-title-l-size)");
  assert.equal(s.fontWeight, "var(--sem-type-title-l-weight)");
  assert.equal(s.color, "var(--sem-color-text-secondary)");
  assert.equal(s.lineHeight, "var(--fnd-type-title-l-line-height)"); // invariante → Foundation
});

test("Text: todo papel Semantic referido existe de fato (nenhum papel fantasma)", () => {
  for (const role of ["display", "body-m", "label", "mono", "caption"] as const) {
    assert.ok(semanticRoles.includes(`type.${role}.size` as SemanticRole), `type.${role}.size ausente`);
    assert.ok(semanticRoles.includes(`type.${role}.weight` as SemanticRole), `type.${role}.weight ausente`);
  }
  for (const tone of ["primary", "secondary", "tertiary", "disabled", "inverse", "on-accent"] as const) {
    assert.ok(semanticRoles.includes(`color.text.${tone}` as SemanticRole), `color.text.${tone} ausente`);
  }
});

test("Surface: background vem da Semantic; raio e padding vêm da Foundation", () => {
  const s = surfaceStyle({ level: "raised", radius: "md", pad: "4" });
  assert.equal(s.background, "var(--sem-color-surface-raised)");
  assert.equal(s.borderRadius, "var(--fnd-radius-md)");
  assert.equal(s.padding, "var(--fnd-space-4)");
});

test("Surface: sem raio/pad não emite as métricas (opt-in), e nível default é 'default'", () => {
  const s = surfaceStyle();
  assert.equal(s.background, "var(--sem-color-surface-default)");
  assert.equal(s.borderRadius, undefined);
  assert.equal(s.padding, undefined);
});

test("Nenhum estilo carrega valor cru — só var(--sem-*)/var(--fnd-*)", () => {
  const all = { ...textStyle("body-m"), ...surfaceStyle({ radius: "lg", pad: "6" }) };
  for (const v of Object.values(all)) assert.match(v, /^var\(--(sem|fnd)-[\w-]+\)$/);
});
