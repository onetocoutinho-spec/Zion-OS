// Testes da Foundation (ENG-002 Etapa 1) — provam que a materialização é FIEL
// ao tokens.json ratificado e que nada foi inventado.
// Rodar: npx tsx --test src/design/foundation/foundation.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { foundation, fnd } from "./foundation.generated.ts";

// `completude` faltava no tipo e o teste já a lia — o type-check dos testes
// (tsconfig.test.json) tornou isso visível.
type Leaf = { $value?: unknown; $extensions: { zion: { posicao: string; completude: string } } };

const HERE = dirname(fileURLToPath(import.meta.url));
const doc = JSON.parse(readFileSync(join(HERE, "..", "tokens.json"), "utf8")) as Record<string, unknown>;
const css = readFileSync(join(HERE, "foundation.css"), "utf8");

// índice símbolo→leaf do tokens.json (fonte única)
const source = new Map<string, { materia: string; leaf: Leaf }>();
for (const [materia, group] of Object.entries(doc)) {
  if (materia.startsWith("$") || typeof group !== "object" || group === null) continue;
  for (const [symbol, leaf] of Object.entries(group as Record<string, Leaf>)) source.set(symbol, { materia, leaf });
}
const genFlat = () => {
  const out: { symbol: string; value: unknown }[] = [];
  for (const items of Object.values(foundation)) for (const [symbol, value] of Object.entries(items)) out.push({ symbol, value });
  return out;
};

test("Fidelidade: todo valor gerado é IDÊNTICO ao do tokens.json (nada inventado)", () => {
  for (const { symbol, value } of genFlat()) {
    const src = source.get(symbol);
    assert.ok(src, `${symbol} gerado mas ausente no tokens.json`);
    assert.equal(src.leaf.$value, value, `${symbol}: valor divergente da fonte`);
    assert.equal(src.leaf.$extensions.zion.posicao, "Foundation", `${symbol} não é Foundation`);
  }
});

test("Só Foundation com $value é emitido; nenhum Incompleto vaza valor", () => {
  const critical = source.get("color.critical-content");
  assert.ok(critical, "color.critical-content ausente no tokens.json");
  assert.equal(critical.leaf.$extensions.zion.completude, "I");
  assert.equal(foundation.Color["color.critical-content" as keyof typeof foundation.Color], undefined);
  // contagem: bate com a Foundation-com-valor da derivação (132)
  assert.equal(genFlat().length, 132);
});

test("Os valores canônicos SÃO os do doc do usuário (não a antiga matemática 1.2)", () => {
  assert.equal(foundation.Color["base.900"], "#0F0F16");
  assert.equal(foundation.Spacing["space.4"], 16);
  assert.equal(foundation.Typography["scale.type.16"], 16);
  assert.equal(foundation.Typography["scale.type.18"], 18); // 18, não 19 (=round(16×1.2))
  assert.equal(foundation.Motion["motion.duration.slow"], "480ms"); // 480, não 500
});

test("CSS: toda var é namespaced --fnd-* (não colide com produção) e casa com o TS", () => {
  const vars = [...css.matchAll(/(--fnd-[\w-]+):\s*([^;]+);/g)];
  assert.equal(vars.length, 132);
  assert.ok(vars.every(([, name]) => name.startsWith("--fnd-")));
  // dimension vira px; cor fica hex; duração fica ms
  const map = new Map(vars.map(([, n, v]) => [n, v.trim()]));
  assert.equal(map.get("--fnd-space-4"), "16px");
  assert.equal(map.get("--fnd-base-900"), "#0F0F16");
  assert.equal(map.get("--fnd-motion-duration-slow"), "480ms");
});

test("fnd(): referência CSS renderizável a partir do símbolo", () => {
  assert.equal(fnd("space.4"), "var(--fnd-space-4)");
  assert.equal(fnd("motion.duration.slow"), "var(--fnd-motion-duration-slow)");
});
