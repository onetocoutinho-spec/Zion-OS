// Gerador da Foundation (ENG-002 Etapa 1).
//
// FONTE ÚNICA: src/design/tokens.json (ratificado; derivado uma vez de
// system/004, autoridade system/000 Ontologia). Este build NÃO computa nem
// inventa valor algum — apenas SELECIONA a Posição Foundation com $value
// concreto e a MATERIALIZA em três formatos. Incompletos (sem $value) jamais
// emitem; são listados como TODO rastreável (foundation.todo.md).
//
// Emite (nenhum arquivo de produção é tocado; tudo namespaced --fnd-*):
//   • foundation.css        — CSS custom properties :root { --fnd-*: … }
//   • foundation.theme.css  — Tailwind v4 @theme inline (utilitários → --fnd-*)
//   • foundation.generated.ts — const tipada p/ consumo TypeScript
//   • foundation.todo.md    — os Incompletos da Foundation, rastreáveis
//
// Rodar: npx tsx scripts/build-foundation.ts

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src", "design", "tokens.json");
const DIR = join(ROOT, "src", "design", "foundation");

interface Leaf {
  $type: string;
  $value?: string | number;
  $description?: string;
  $extensions: { zion: { materia: string; posicao: string; completude: string; especie: string } };
}
const doc = JSON.parse(readFileSync(SRC, "utf8")) as Record<string, unknown>;

// ── Seleção: Posição Foundation ──────────────────────────────────────────────
const foundation: { symbol: string; materia: string; leaf: Leaf }[] = [];
const incompletos: { symbol: string; materia: string; especie: string; nota: string }[] = [];
for (const [materia, group] of Object.entries(doc)) {
  if (materia.startsWith("$") || typeof group !== "object" || group === null) continue;
  for (const [symbol, raw] of Object.entries(group as Record<string, Leaf>)) {
    const leaf = raw as Leaf;
    if (leaf.$extensions?.zion?.posicao !== "Foundation") continue;
    if (leaf.$value === undefined || leaf.$value === null) {
      incompletos.push({
        symbol, materia,
        especie: leaf.$extensions.zion.especie,
        nota: leaf.$description ?? "(sem $value emitível)",
      });
      continue;
    }
    foundation.push({ symbol, materia, leaf });
  }
}
foundation.sort((a, b) => a.symbol.localeCompare(b.symbol));

// ── Materialização de um $value em texto CSS (por $type; sem invenção) ───────
const cssVarName = (symbol: string) => `--fnd-${symbol.replace(/\./g, "-")}`;
function cssValue(leaf: Leaf): string {
  const v = leaf.$value!;
  switch (leaf.$type) {
    case "dimension": return `${v}px`;
    case "duration": return String(v); // já vem "480ms"
    case "color": return String(v);
    case "number":
    case "fontWeight": return String(v);
    default: return String(v);
  }
}

const banner = "/* GERADO por scripts/build-foundation.ts a partir de src/design/tokens.json (fonte única). NÃO editar à mão. */";

// ── foundation.css ───────────────────────────────────────────────────────────
const cssBody = foundation.map(({ symbol, leaf }) => `  ${cssVarName(symbol)}: ${cssValue(leaf)};`).join("\n");
writeFileSync(join(DIR, "foundation.css"), `${banner}\n:root {\n${cssBody}\n}\n`);

// ── foundation.theme.css (Tailwind v4) ───────────────────────────────────────
// Mapeia namespaces de utilitário do Tailwind v4 aos --fnd-*. Importar SÓ na
// superfície da slice — jamais no globals.css de produção.
const theme: string[] = [];
for (const { symbol, materia } of foundation) {
  const v = `var(${cssVarName(symbol)})`;
  if (materia === "Spacing" && symbol.startsWith("space.")) theme.push(`  --spacing-${symbol.slice(6)}: ${v};`);
  else if (materia === "Radius" && symbol.startsWith("radius.")) theme.push(`  --radius-${symbol.slice(7)}: ${v};`);
  else if (materia === "Typography" && symbol.startsWith("scale.type.")) theme.push(`  --text-${symbol.slice(11)}: ${v};`);
  else if (materia === "Color") theme.push(`  --color-${symbol.replace(/\./g, "-")}: ${v};`);
}
writeFileSync(join(DIR, "foundation.theme.css"), `${banner}\n@theme inline {\n${theme.join("\n")}\n}\n`);

// ── foundation.generated.ts (face TypeScript tipada) ─────────────────────────
const byMateria = new Map<string, { symbol: string; value: string | number }[]>();
for (const { symbol, materia, leaf } of foundation) {
  if (!byMateria.has(materia)) byMateria.set(materia, []);
  byMateria.get(materia)!.push({ symbol, value: leaf.$value! });
}
const tsGroups = [...byMateria.entries()]
  .map(([materia, items]) => {
    const lines = items.map(({ symbol, value }) => `    ${JSON.stringify(symbol)}: ${JSON.stringify(value)},`).join("\n");
    return `  ${JSON.stringify(materia)}: {\n${lines}\n  },`;
  })
  .join("\n");
const tsBody = `${banner.replace("/*", "//").replace("*/", "").trim()}
// Valores brutos da Foundation (número em px lógicos; cor em hex; duração em ms).
// A camada Semantic (system/005) referirá estes símbolos; componentes nunca os
// consomem direto (DS-100). Para o valor renderizável, prefira fnd("símbolo").

export const foundation = {
${tsGroups}
} as const;

/** Referência CSS renderizável de um símbolo Foundation: fnd("space.4") → "var(--fnd-space-4)". */
export function fnd(symbol: string): string {
  return \`var(--fnd-\${symbol.replace(/\\./g, "-")})\`;
}

export type FoundationMateria = keyof typeof foundation;
`;
writeFileSync(join(DIR, "foundation.generated.ts"), tsBody);

// ── foundation.todo.md (Incompletos rastreáveis) ─────────────────────────────
incompletos.sort((a, b) => a.symbol.localeCompare(b.symbol));
const todo = `# Foundation — Incompletos rastreáveis (ENG-002 Etapa 1)

> GERADO por scripts/build-foundation.ts. Estes símbolos da Posição Foundation
> **existem** (Norma 5.5.1) mas **não têm \\$value emitível** — Restrições, Operações,
> Unidades ou enums em prosa. **Nenhum valor foi inventado.** Não bloqueiam a
> Vertical Slice Zero desde que Shell/Mission/primitivos desta etapa não os
> consumam. Se um destes virar necessário, PARAR e solicitar decisão arquitetural.

Total: ${incompletos.length}

| Símbolo | Matéria | Espécie | Nota |
|---|---|---|---|
${incompletos.map((i) => `| \`${i.symbol}\` | ${i.materia} | ${i.especie} | ${i.nota.replace(/\|/g, "\\|").slice(0, 120)} |`).join("\n")}
`;
writeFileSync(join(DIR, "foundation.todo.md"), todo);

console.log(`Foundation materializada de tokens.json:`);
console.log(`  ${foundation.length} tokens com valor → foundation.css · foundation.theme.css · foundation.generated.ts`);
console.log(`  ${incompletos.length} Incompletos → foundation.todo.md (rastreáveis, não emitem)`);
