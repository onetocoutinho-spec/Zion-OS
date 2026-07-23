// DERIVAÇÃO ÚNICA (ENG-002 Etapa 1) — lê docs/product/system/004-design-tokens.md
// e emite src/design/tokens.json (DTCG + $extensions.zion).
//
// Este script é ferramenta de USO ÚNICO. Após a validação humana do tokens.json,
// o .md deixa de ser entrada de compilador (vira documentação sincronizada) e o
// tokens.json passa a ser a ÚNICA fonte de verdade machine-readable do build.
// Ele NÃO faz parte da esteira de build; existe só para provar a fidelidade da
// transcrição (checksum contra a Parte E do doc) e nunca inventa valor.
//
// Rodar: npx tsx scripts/derive-tokens-from-doc.ts

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DOC = join(ROOT, "docs", "product", "system", "004-design-tokens.md");
const OUT = join(ROOT, "src", "design", "tokens.json");

const md = readFileSync(DOC, "utf8").split(/\r?\n/);

// ── Modelo de um Token extraído ──────────────────────────────────────────────
interface Zion {
  materia: string;
  posicao: "Foundation" | "Semantic" | "Component";
  especie: string;
  escopo: string;
  completude: "C" | "I";
  destinacao: string | null;
  conteudo: unknown; // estruturado quando possível; senão, string crua
  raw: string; // a célula Conteúdo, verbatim
}
interface Token {
  symbol: string;
  $type: string;
  $value: string | number | null; // concreto SÓ quando Foundation Valor escalar
  $description?: string;
  $extensions: { zion: Zion };
}

// ── $type DTCG por Matéria + Símbolo ─────────────────────────────────────────
function dtcgType(materia: string, sym: string): string {
  switch (materia) {
    case "Color": return "color";
    case "Typography":
      if (sym.startsWith("scale.type")) return "dimension";
      if (sym.includes("line-height")) return "number";
      if (sym.includes("weight")) return "fontWeight";
      return "other"; // family / measure / numeral
    case "Spacing": return "dimension";
    case "Radius": return "dimension";
    case "Elevation": return "number"; // nível na ordem de profundidade
    case "Shadow": return "dimension"; // offset / blur
    case "Iconography": return sym.includes("size") ? "dimension" : "other";
    case "Traço": return "dimension";
    case "Grid": return sym.includes("columns") ? "number" : "dimension";
    case "Layout": return "dimension";
    case "Motion": return sym.includes("easing") ? "cubicBezier" : "duration";
    case "State": return "other";
    case "A11y": return "other";
    default: return "other";
  }
}

// ── Parse do Conteúdo (best-effort; nunca inventa) ───────────────────────────
const CTX = { "Dark": "dark", "Light": "light", "High Contrast": "hc" } as const;
const HEX = /^#[0-9A-Fa-f]{3,8}$/;

function stripTicks(s: string): string { return s.replace(/`/g, "").trim(); }

function parseContent(raw: string, especie: string): {
  value: string | number | null; content: unknown;
} {
  const cell = raw.trim();

  // Escalar puro: número (ex.: "16", "1.5", "9999") — Foundation Valor
  if (/^-?\d+(\.\d+)?$/.test(cell)) return { value: Number(cell), content: Number(cell) };
  // Duração "320 ms"
  const ms = cell.match(/^(\d+)\s*ms$/);
  if (ms) return { value: `${ms[1]}ms`, content: `${ms[1]}ms` };
  // Hex puro
  if (HEX.test(cell)) return { value: cell, content: cell };

  // Multi-contexto / multi-estado: partes separadas por <br>, cada uma "**Rótulo** conteúdo"
  if (cell.includes("<br>") || /^\*\*[^*]+\*\*/.test(cell)) {
    const parts = cell.split(/<br>/).map((p) => p.trim()).filter(Boolean);
    const byLabel: Record<string, string> = {};
    let ok = true;
    for (const p of parts) {
      const m = p.match(/^\*\*([\s\S]+?)\*\*\s*([\s\S]*)$/);
      if (!m) { ok = false; break; }
      const label = m[1].trim();
      const key = (CTX as Record<string, string>)[label] ?? label; // contexto conhecido → chave curta
      byLabel[key] = m[2].trim();
    }
    if (ok && parts.length) return { value: null, content: byLabel };
  }

  // Referência única: "Referência → x" | "Referência a[o] [Símbolo] `x`" | "→ x"
  // Consome o artigo (a/ao/à) e "Símbolo" antes do alvo; hífens fazem parte do símbolo.
  const ref = cell.match(/(?:Refer[eê]ncia\s*(?:a[oà]?\s+)?(?:ao\s+)?(?:S[íi]mbolo\s+)?(?:→\s*)?|→\s*)`?([a-z][\w-]*(?:\.[\w-]+)*)`?/i);
  if (ref && especie === "Referência") return { value: null, content: { ref: stripTicks(ref[1]) } };

  // Restrição / Operação / Transformação / Unidade → prosa (Incompleto ou regra)
  return { value: null, content: cell };
}

// ── Varredura do documento ───────────────────────────────────────────────────
const tokens: Token[] = [];
let materia = "";
let posicao: Zion["posicao"] | "" = "";
const declaredByPos: Record<string, number> = {};

for (const line of md) {
  const mSec = line.match(/^###\s+Matéria\s+·\s+(.+?)\s*$/);
  if (mSec) { materia = mSec[1].trim(); posicao = ""; continue; }

  const mPos = line.match(/^\*\*Posição\s+(Foundation|Semantic|Component)\*\*\s+—\s+(\d+)/);
  if (mPos) {
    posicao = mPos[1] as Zion["posicao"];
    declaredByPos[posicao] = (declaredByPos[posicao] ?? 0) + Number(mPos[2]);
    continue;
  }

  // Linha de token: começa com "| `symbol` |"
  const mRow = line.match(/^\|\s*`([^`]+)`\s*\|(.+)\|\s*$/);
  if (!mRow || !materia || !posicao) continue;
  const symbol = mRow[1].trim();
  const cols = mRow[2].split("|").map((c) => c.trim());
  if (cols.length < 5) continue; // cabeçalho/separador
  const [especie, escopo, compl, destRaw, ...rest] = cols;
  const raw = rest.join("|").trim(); // Conteúdo pode conter '|' escapado? (não nas tabelas)
  const completude = compl === "I" ? "I" : "C";
  const destinacao = destRaw === "—" || destRaw === "" ? null : stripTicks(destRaw);

  const { value, content } = parseContent(raw, especie);
  const $type = dtcgType(materia, symbol);
  const tok: Token = {
    symbol,
    $type,
    $value: value,
    $extensions: {
      zion: { materia, posicao, especie, escopo, completude, destinacao, conteudo: content, raw },
    },
  };
  if (completude === "I" && value === null) tok.$description = raw;
  tokens.push(tok);
}

// ── Checksum contra a Parte E do documento ───────────────────────────────────
const byPos = (p: string) => tokens.filter((t) => t.$extensions.zion.posicao === p).length;
const byCompl = (c: string) => tokens.filter((t) => t.$extensions.zion.completude === c).length;
const byScope = (s: string) => tokens.filter((t) => t.$extensions.zion.escopo === s).length;
const materias = new Set(tokens.map((t) => t.$extensions.zion.materia));

// ── Integridade: Referências pendentes (alvo não é Símbolo declarado) ────────
const symbols = new Set(tokens.map((t) => t.symbol));
const dangling: { from: string; to: string }[] = [];
for (const t of tokens) {
  const c = t.$extensions.zion.conteudo as Record<string, unknown>;
  const refs: string[] = [];
  if (c && typeof c === "object") {
    if (typeof (c as { ref?: string }).ref === "string") refs.push((c as { ref: string }).ref);
    for (const v of Object.values(c)) {
      if (typeof v === "string") {
        // captura símbolos referidos dentro do conteúdo por-contexto/por-estado (hífens incluídos)
        const re = /`?([a-z][\w-]*(?:\.[\w-]+)+)`?/g;
        let m: RegExpExecArray | null;
        while ((m = re.exec(v))) {
          if (/^(color|type|space|radius|base|brand|alert|caution|info|positive|elevation|shadow|motion|state|layout|grid|icon|a11y|scale)\./.test(m[1])) refs.push(m[1]);
        }
      }
    }
  }
  for (const r of refs) {
    const head = r.split(" ")[0];
    if (!symbols.has(head) && !dangling.some((d) => d.from === t.symbol && d.to === head)) {
      dangling.push({ from: t.symbol, to: head });
    }
  }
}

// ── Emissão do tokens.json (agrupado por Matéria › Posição › símbolo) ────────
type Node = Record<string, unknown>;
const tree: Node = {
  $schema: "https://design-tokens.github.io/community-group/format/",
  $description:
    "Fonte de verdade machine-readable do Design System da Zion. Derivado UMA vez de docs/product/system/004-design-tokens.md (autoridade: system/000 Ontologia). Após validação humana, ESTE arquivo é a fonte; o .md é documentação sincronizada. Ver scripts/derive-tokens-from-doc.ts.",
};
for (const t of tokens) {
  const g = t.$extensions.zion.materia;
  const node: Node = ((tree[g] as Node) ??= {});
  const leaf: Node = { $type: t.$type };
  if (t.$value !== null) leaf.$value = t.$value;
  if (t.$description) leaf.$description = t.$description;
  leaf.$extensions = t.$extensions;
  node[t.symbol] = leaf;
}
writeFileSync(OUT, JSON.stringify(tree, null, 2) + "\n");

// ── Relatório ────────────────────────────────────────────────────────────────
const line = (a: string, got: number, want: number) =>
  `  ${got === want ? "✔" : "�’✘"} ${a}: ${got} (doc diz ${want})`;
console.log(`\n── DERIVAÇÃO tokens.json ────────────────────────────────`);
console.log(`Total de Tokens extraídos: ${tokens.length} (doc diz 304)`);
console.log(line("Foundation", byPos("Foundation"), 164));
console.log(line("Semantic", byPos("Semantic"), 74));
console.log(line("Component", byPos("Component"), 66));
console.log(line("Completos", byCompl("C"), 253));
console.log(line("Incompletos", byCompl("I"), 51));
console.log(line("universal", byScope("universal"), 154));
console.log(line("domínio Zion", byScope("domínio Zion"), 150));
console.log(`  Matérias distintas: ${materias.size} (doc diz 13) → ${[...materias].join(", ")}`);
console.log(`\n── INTEGRIDADE (a validar por humano) ───────────────────`);
console.log(`Foundation com $value concreto (emitíveis já): ${tokens.filter((t) => t.$extensions.zion.posicao === "Foundation" && t.$value !== null).length}`);
console.log(`Referências pendentes (alvo não declarado como Símbolo): ${dangling.length}`);
for (const d of dangling.slice(0, 40)) console.log(`    ${d.from}  →  ${d.to}  (ausente)`);
if (dangling.length > 40) console.log(`    … +${dangling.length - 40}`);
console.log(`\ntokens.json escrito em src/design/tokens.json\n`);
