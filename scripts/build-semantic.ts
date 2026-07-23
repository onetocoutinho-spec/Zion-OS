// Gerador da camada Semantic (ENG-002 Etapa 2 — system/005).
//
// FONTE ÚNICA: src/design/tokens.json (ratificado). Seleciona a Posição Semantic
// e RESOLVE cada papel para a Foundation (ou para outro papel Semantic), por
// Contexto (Dark = :root/primário; Light e High-Contrast em [data-context]).
// NÃO inventa: referência pendente (alvo não declarado) ou rampa/grupo nu é
// PULADA e listada em semantic.todo.md. Transformação `X @ N%` vira color-mix.
//
// Emite (namespaced --sem-*; a Foundation continua --fnd-*):
//   • semantic.css          — papéis por Contexto (:root + [data-context])
//   • semantic.generated.ts — sem("color.text.primary") + papéis disponíveis
//   • semantic.todo.md      — papéis não-resolvíveis (rastreáveis)
//
// Rodar: npx tsx scripts/build-semantic.ts

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "src", "design", "semantic");
const doc = JSON.parse(readFileSync(join(ROOT, "src", "design", "tokens.json"), "utf8")) as Record<string, any>;

// ── Conjuntos de símbolos por Posição (para classificar --fnd- vs --sem-) ────
const foundationSyms = new Set<string>();
const semanticSyms = new Set<string>();
const allSyms = new Set<string>();
for (const [materia, group] of Object.entries(doc)) {
  if (materia.startsWith("$") || typeof group !== "object" || group === null) continue;
  for (const [symbol, leaf] of Object.entries(group as Record<string, any>)) {
    allSyms.add(symbol);
    const pos = leaf.$extensions?.zion?.posicao;
    if (pos === "Foundation") foundationSyms.add(symbol);
    if (pos === "Semantic") semanticSyms.add(symbol);
  }
}
const cssvar = (sym: string) => sym.replace(/\./g, "-");
const todo: { symbol: string; motivo: string }[] = [];

/** Resolve UM símbolo para a var() certa, ou null se não emitível (rastreia). */
function refVar(sym: string, from: string): string | null {
  if (foundationSyms.has(sym)) return `var(--fnd-${cssvar(sym)})`;
  if (semanticSyms.has(sym)) return `var(--sem-${cssvar(sym)})`;
  todo.push({ symbol: from, motivo: `referência a \`${sym}\` (alvo não declarado ou rampa/grupo nu)` });
  return null;
}

/** Resolve o CONTEÚDO de um Contexto (string) → texto CSS, ou null. */
function resolveValue(raw: string, from: string): string | null {
  const s = raw.trim();
  if (/não declarado/i.test(s)) return null;
  if (/^#[0-9A-Fa-f]{3,8}$/.test(s)) return s; // hex literal
  // Transformação: `X @ N%`  →  color-mix(in srgb, <ref X> N%, transparent)
  const tf = s.match(/`?([a-z][\w.]+)`?\s*@\s*(\d+)%/i);
  if (tf) {
    const v = refVar(tf[1], from);
    return v ? `color-mix(in srgb, ${v} ${tf[2]}%, transparent)` : null;
  }
  // Símbolo referido: ticado `X` ou bare "X" (com ao menos um ponto = símbolo pleno)
  const ticked = s.match(/`([a-z][\w.]+)`/i);
  const bare = s.match(/^([a-z][\w]+(?:\.[\w]+)+)\b/i);
  const sym = ticked?.[1] ?? bare?.[1];
  if (sym) return refVar(sym, from);
  // Rampa/grupo nu (ex.: "brand", "info") ou prosa → não emitível
  todo.push({ symbol: from, motivo: `conteúdo não resolvível a um símbolo pleno: "${s.slice(0, 60)}"` });
  return null;
}

// ── Coleta por Contexto ──────────────────────────────────────────────────────
const CTX = ["dark", "light", "hc"] as const;
type Ctx = (typeof CTX)[number];
const rootVars: string[] = []; // Dark (primário) + context-independent + estados
const ctxVars: Record<Ctx, string[]> = { dark: [], light: [], hc: [] };
const emitted: { symbol: string; contextual: boolean }[] = [];

for (const materia of Object.keys(doc)) {
  if (materia.startsWith("$")) continue;
  for (const [symbol, leaf] of Object.entries(doc[materia] as Record<string, any>)) {
    if (leaf.$extensions?.zion?.posicao !== "Semantic") continue;
    const conteudo = leaf.$extensions.zion.conteudo;
    const name = `--sem-${cssvar(symbol)}`;

    if (conteudo && typeof conteudo === "object" && "ref" in conteudo) {
      // Referência única, independente de Contexto
      const v = refVar((conteudo as any).ref, symbol);
      if (v) { rootVars.push(`  ${name}: ${v};`); emitted.push({ symbol, contextual: false }); }
      continue;
    }
    if (conteudo && typeof conteudo === "object") {
      const keys = Object.keys(conteudo);
      const isCtx = keys.some((k) => (CTX as readonly string[]).includes(k));
      const isEstado = keys.some((k) => k.startsWith("estado "));
      if (isCtx) {
        let any = false;
        for (const c of CTX) {
          if (!(c in conteudo)) continue;
          const v = resolveValue(String((conteudo as any)[c]), symbol);
          if (!v) continue;
          any = true;
          if (c === "dark") rootVars.push(`  ${name}: ${v};`); // Dark = primário no :root
          else ctxVars[c].push(`  ${name}: ${v};`);
        }
        if (any) emitted.push({ symbol, contextual: true });
        continue;
      }
      if (isEstado) {
        // Mapa de estado → um papel por estado (o alvo Semantic já é context-aware)
        for (const [k, val] of Object.entries(conteudo)) {
          const estado = k.replace(/^estado\s+/, "").split(/\s|—/)[0].trim();
          const v = resolveValue(String(val), symbol);
          if (v) { rootVars.push(`  ${name}-${estado}: ${v};`); emitted.push({ symbol: `${symbol}.${estado}`, contextual: false }); }
        }
        continue;
      }
    }
    // string crua (prosa) → não emitível
    todo.push({ symbol, motivo: `conteúdo Semantic em prosa: "${String(conteudo).slice(0, 60)}"` });
  }
}

// ── semantic.css ─────────────────────────────────────────────────────────────
const banner = "/* GERADO por scripts/build-semantic.ts a partir de src/design/tokens.json. NÃO editar à mão. */";
const css =
  `${banner}\n` +
  `/* Dark é o Contexto primário (system/004). Trocar de Contexto = data-context no elemento raiz. */\n` +
  `:root {\n${rootVars.sort().join("\n")}\n}\n\n` +
  `[data-context="light"] {\n${ctxVars.light.sort().join("\n")}\n}\n\n` +
  `[data-context="hc"] {\n${ctxVars.hc.sort().join("\n")}\n}\n`;
writeFileSync(join(DIR, "semantic.css"), css);

// ── semantic.generated.ts ────────────────────────────────────────────────────
const roles = [...new Set(emitted.map((e) => e.symbol))].sort();
const ts =
  `// GERADO por scripts/build-semantic.ts a partir de src/design/tokens.json. NÃO editar à mão.\n` +
  `// Papéis (Semantic) disponíveis para os primitivos. Componentes consomem ESTES,\n` +
  `// nunca a Foundation direto (DS-100). Para o valor: sem("color.text.primary").\n\n` +
  `export const semanticRoles = ${JSON.stringify(roles, null, 2)} as const;\n\n` +
  `export type SemanticRole = (typeof semanticRoles)[number];\n\n` +
  `/** Referência CSS de um papel Semantic: sem("color.text.primary") → "var(--sem-color-text-primary)". */\n` +
  `export function sem(role: SemanticRole): string {\n  return \`var(--sem-\${role.replace(/\\./g, "-")})\`;\n}\n`;
writeFileSync(join(DIR, "semantic.generated.ts"), ts);

// ── semantic.todo.md ─────────────────────────────────────────────────────────
const uniqTodo = todo.filter((t, i) => todo.findIndex((x) => x.symbol === t.symbol && x.motivo === t.motivo) === i)
  .sort((a, b) => a.symbol.localeCompare(b.symbol));
writeFileSync(join(DIR, "semantic.todo.md"),
  `# Semantic — papéis não-resolvíveis (ENG-002 Etapa 2)\n\n` +
  `> GERADO. Papéis da Posição Semantic cujo conteúdo NÃO resolve a um símbolo\n` +
  `> declarado (alvo ausente, rampa/grupo nu, ou prosa). **Nada foi inventado.**\n` +
  `> Se um primitivo precisar de um destes, PARAR e pedir decisão arquitetural.\n\n` +
  `Total: ${uniqTodo.length}\n\n| Papel | Motivo |\n|---|---|\n` +
  uniqTodo.map((t) => `| \`${t.symbol}\` | ${t.motivo.replace(/\|/g, "\\|")} |`).join("\n") + "\n");

console.log(`Semantic materializada de tokens.json:`);
console.log(`  papéis emitidos (símbolos distintos): ${roles.length}`);
console.log(`  vars :root(Dark)=${rootVars.length} · light=${ctxVars.light.length} · hc=${ctxVars.hc.length}`);
console.log(`  não-resolvíveis → semantic.todo.md: ${uniqTodo.length}`);
