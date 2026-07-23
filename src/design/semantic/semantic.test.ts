// Testes da camada Semantic (ENG-002 Etapa 2) — provam que todo papel resolve
// para a Foundation (ou outro papel), por Contexto, sem vazar símbolo cru nem
// referência pendente.
// Rodar: npx tsx --test src/design/semantic/semantic.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { semanticRoles, sem } from "./semantic.generated.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(HERE, "semantic.css"), "utf8");
const todo = readFileSync(join(HERE, "semantic.todo.md"), "utf8");

const decls = [...css.matchAll(/(--sem-[\w-]+):\s*([^;]+);/g)].map(([, n, v]) => ({ n, v: v.trim() }));

test("Todo valor Semantic resolve para var(--fnd-*), var(--sem-*), color-mix ou hex — nada cru", () => {
  const ok = /^(var\(--fnd-[\w-]+\)|var\(--sem-[\w-]+\)|color-mix\(in srgb, var\(--(fnd|sem)-[\w-]+\) \d+%, transparent\)|#[0-9A-Fa-f]{3,8})$/;
  for (const { n, v } of decls) assert.ok(ok.test(v), `${n}: valor cru/não-resolvido → ${v}`);
});

test("Nenhuma referência pendente vaza como var emitida (dangling fica só no todo)", () => {
  assert.ok(/color.coach/.test(todo) && /state.disabled.icon/.test(todo));
  assert.equal(decls.find((d) => d.n === "--sem-color-coach"), undefined);
  assert.equal(decls.find((d) => d.n === "--sem-state-disabled-icon"), undefined);
});

test("Contexto: o mesmo papel resolve diferente em Dark(:root) e Light([data-context])", () => {
  const root = css.slice(0, css.indexOf('[data-context="light"]'));
  const light = css.slice(css.indexOf('[data-context="light"]'), css.indexOf('[data-context="hc"]'));
  assert.match(root, /--sem-color-surface-canvas: var\(--fnd-base-950\)/); // Dark
  assert.match(light, /--sem-color-surface-canvas: var\(--fnd-base-50\)/); // Light
});

test("Transformação-alfa vira color-mix (fiel a `X @ N%`)", () => {
  const border = decls.find((d) => d.n === "--sem-color-border-default");
  assert.equal(border?.v, "color-mix(in srgb, var(--fnd-base-0) 10%, transparent)");
});

test("Mapa de estado vira um papel por estado, apontando para outro papel", () => {
  assert.equal(decls.find((d) => d.n === "--sem-color-health-healthy")?.v, "var(--sem-color-success)");
  assert.ok(semanticRoles.includes("color.health.healthy" as any));
});

test("sem(): referência CSS a partir do papel", () => {
  assert.equal(sem("color.text.primary" as any), "var(--sem-color-text-primary)");
});
