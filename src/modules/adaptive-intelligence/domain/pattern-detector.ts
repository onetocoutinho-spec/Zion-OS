// Núcleo do Pattern Detector (R-PD-1, Etapa 2) — RFC-AIL-004.
//
// DOMÍNIO 100% PURO: nenhum I/O, nenhum banco, nenhum Repository, nenhum
// Mapper, nenhum efeito colateral. Uma única função:
//
//   Decision[]  →  Pattern[]
//
// DETERMINÍSTICA E CONFLUENTE (RFC-AIL-004 §7.3): o resultado é função pura do
// MULTICONJUNTO de Decisions — independente da ordem de entrada. Garantias:
//   - dedup por DecisionId (conjunto, não contador — §7.1: replay é no-op);
//   - primeira/última ocorrência por min/max de decidido_em (não por chegada),
//     com desempate lexicográfico em instantes iguais;
//   - decisoesDeSuporte ordenadas lexicograficamente;
//   - saída ordenada pela chave canônica.
// Reusa exatamente as funções da Etapa 0 (elegibilidade, canonicalização,
// chave, slot, PatternId, escada, estados) — nenhuma lógica duplicada,
// nenhuma heurística nova.

import type { Decision } from "./decision.ts";
import {
  chaveCanonica,
  chaveDe,
  patternIdDe,
  slotCanonico,
  type PatternKey,
} from "./pattern-key.ts";
import { confidenceDe, estadoDe, estadoDoSlot, type Padrao } from "./pattern.ts";

interface Grupo {
  chave: PatternKey;
  chaveTexto: string;
  slotTexto: string;
  /** DecisionId → decidido_em. Map = deduplicação por id, por construção. */
  porDecisao: Map<string, string>;
}

/** a é anterior a b? Instantes iguais desempatam pela string (confluência). */
function anterior(a: string, b: string): boolean {
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta < tb;
  return a < b;
}

/**
 * Computa o conjunto exato de Patterns de uma sequência de Decisions
 * (RFC-AIL-004 §3–§5). Assíncrona apenas pelo PatternId (SHA-256 via WebCrypto
 * — computação, não I/O).
 */
export async function computarPadroes(
  decisoes: readonly Decision[]
): Promise<Padrao[]> {
  // 1–5. Elegibilidade → canonicalização → chave → dedup por DecisionId → agrupamento.
  const grupos = new Map<string, Grupo>();
  for (const d of decisoes) {
    const chave = chaveDe(d); // Etapa 0: elegibilidade + forma canônica (RFC-AIL-003)
    if (!chave) continue; // inelegível: nenhum efeito (RFC-AIL-004 §3)
    const chaveTexto = chaveCanonica(chave);
    let grupo = grupos.get(chaveTexto);
    if (!grupo) {
      grupo = { chave, chaveTexto, slotTexto: slotCanonico(chave), porDecisao: new Map() };
      grupos.set(chaveTexto, grupo);
    }
    if (!grupo.porDecisao.has(d.id)) grupo.porDecisao.set(d.id, d.timestamp);
  }

  // Estado dos slots a partir dos suportes dos concorrentes (RFC-AIL-004 §4.4).
  const suportesPorSlot = new Map<string, number[]>();
  for (const g of grupos.values()) {
    const suportes = suportesPorSlot.get(g.slotTexto) ?? [];
    suportes.push(g.porDecisao.size);
    suportesPorSlot.set(g.slotTexto, suportes);
  }

  // 6–7. Cálculo dos acúmulos derivados e montagem do Pattern.
  const padroes: Padrao[] = [];
  for (const g of grupos.values()) {
    const slotEstado = estadoDoSlot(suportesPorSlot.get(g.slotTexto) ?? []);
    const ocorrencias = g.porDecisao.size;
    const confidence = confidenceDe(ocorrencias, slotEstado);
    const tempos = Array.from(g.porDecisao.values());
    const primeiraOcorrencia = tempos.reduce((min, t) => (anterior(t, min) ? t : min));
    const ultimaOcorrencia = tempos.reduce((max, t) => (anterior(max, t) ? t : max));
    padroes.push({
      id: await patternIdDe(g.chave),
      chave: g.chaveTexto,
      empresa: g.chave.empresa,
      contexto: g.chave.contexto,
      campo: g.chave.campo,
      valorNovo: g.chave.valorNovo,
      ocorrencias,
      decisoesDeSuporte: Array.from(g.porDecisao.keys()).sort(),
      primeiraOcorrencia,
      ultimaOcorrencia,
      confidence,
      estado: estadoDe(confidence),
      slotEstado,
    });
  }

  // Saída em ordem canônica — mesma entrada (em qualquer ordem) → mesma saída.
  padroes.sort((a, b) => (a.chave < b.chave ? -1 : a.chave > b.chave ? 1 : 0));
  return padroes;
}
