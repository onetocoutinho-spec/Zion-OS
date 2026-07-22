// PatternKey — a identidade lógica de um Pattern (RFC-AIL-003).
//
// DOMÍNIO PURO: sem I/O, sem banco, sem Repository, sem Mapper. Implementa
// exatamente a RFC-AIL-003: forma canônica (§4.2), elegibilidade (§4.4/§5),
// a chave (empresa, contexto, campo, valorNovo) (§3.2), o slot (§3.3) e o
// PatternId (identidade de persistência derivada da chave por SHA-256 —
// determinística; a PatternKey permanece armazenada para explicabilidade).

import type { Decision } from "./decision.ts";

/** Os sete Bounded Contexts canônicos (Cap. 02; RFC-AIL-003 §5.2 — domínio FECHADO). */
export const BOUNDED_CONTEXTS: ReadonlySet<string> = new Set([
  "catalogo",
  "esteira",
  "precificacao",
  "conexao",
  "publicacao",
  "vendas",
  "identidade",
]);

/**
 * Política de caixa POR CAMPO (RFC-AIL-003 §4.2: "fixa por campo, publicada e
 * estável"). Texto livre compara-se com caixa dobrada; domínios fechados
 * sensíveis a caixa (ids como MLB273770) comparam-se exatos (padrão).
 */
const CAMPOS_COM_CAIXA_DOBRADA: ReadonlySet<string> = new Set(["informacaoPendente"]);

/** Normalização estrutural (§4.2): NFC + apara bordas + colapsa espaços internos. */
function normalizarEstrutural(valor: string): string {
  return valor.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Forma canônica de um componente, segundo a política de caixa do campo. */
export function canonicalizarValor(valor: string, campoCanonico: string): string {
  const estrutural = normalizarEstrutural(valor);
  return CAMPOS_COM_CAIXA_DOBRADA.has(campoCanonico)
    ? estrutural.toLowerCase()
    : estrutural;
}

/** Contexto canônico: estrutural + caixa baixa (o conjunto fechado é minúsculo). */
export function canonicalizarContexto(contexto: string): string {
  return normalizarEstrutural(contexto).toLowerCase();
}

/** A quádrupla canônica que É a identidade do Pattern (RFC-AIL-003 §3.2). */
export interface PatternKey {
  readonly empresa: string;
  readonly contexto: string;
  readonly campo: string;
  readonly valorNovo: string;
}

/**
 * Deriva a PatternKey canônica de uma Decision — ou null se INELEGÍVEL.
 * Elegibilidade (RFC-AIL-003 §4.4/§5): tenant presente; contexto pertence ao
 * conjunto fechado de Bounded Contexts; campo substantivo presente; valorNovo
 * de domínio significativo (não vazio após canonicalização); delta real
 * (valorAnterior ≠ valorNovo na forma canônica; null → valor é delta válido).
 * Decisions inelegíveis NÃO recebem chave e não participam de aprendizado.
 */
export function chaveDe(decisao: Decision): PatternKey | null {
  const empresa = normalizarEstrutural(decisao.empresa);
  if (!empresa) return null;

  const contexto = canonicalizarContexto(decisao.contexto);
  if (!BOUNDED_CONTEXTS.has(contexto)) return null;

  const campo = normalizarEstrutural(decisao.campo);
  if (!campo) return null;

  const valorNovo = canonicalizarValor(decisao.valorNovo, campo);
  if (!valorNovo) return null;

  const valorAnterior =
    decisao.valorAnterior === null ? null : canonicalizarValor(decisao.valorAnterior, campo);
  if (valorAnterior === valorNovo) return null; // sem delta, não há correção a aprender

  return { empresa, contexto, campo, valorNovo };
}

/**
 * Representação canônica textual da chave — armazenada no Pattern para
 * explicabilidade ("qual Pattern?" responde-se com a própria chave —
 * RFC-AIL-002 §8). JSON de array: determinística, não-ambígua e reversível.
 */
export function chaveCanonica(chave: PatternKey): string {
  return JSON.stringify([chave.empresa, chave.contexto, chave.campo, chave.valorNovo]);
}

/** O slot = projeção (empresa, contexto, campo) da chave (RFC-AIL-003 §3.3). */
export function slotCanonico(chave: PatternKey): string {
  return JSON.stringify([chave.empresa, chave.contexto, chave.campo]);
}

/**
 * PatternId — identidade de domínio e chave de persistência do Pattern:
 * SHA-256 (hex) da PatternKey canônica. Determinístico: mesma chave → mesmo id,
 * em qualquer execução/ambiente. Sem I/O (computação via WebCrypto, disponível
 * em navegador e Node).
 */
export async function patternIdDe(chave: PatternKey): Promise<string> {
  const bytes = new TextEncoder().encode(chaveCanonica(chave));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
