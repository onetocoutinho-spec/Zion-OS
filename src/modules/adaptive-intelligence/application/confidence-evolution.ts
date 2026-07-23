// Confidence Evolution (E5.3) — a Confidence sobrevive sem a influência do
// próprio sistema?
//
// A primeira projeção capaz de REAVALIAR o estado do conhecimento — jamais de
// criá-lo. Decisão de design central, derivada das regras congeladas:
//
//   ZERO números novos. A confidence projetada é calculada EXCLUSIVAMENTE com
//   as funções congeladas do Detector (`confidenceDe`, `estadoDoSlot` —
//   RFC-AIL-004 §4.3/§4.4), aplicadas ao SUPORTE INDEPENDENTE: o suporte do
//   Pattern APÓS remover as Decisions consumidas por Ofertas confirmadas.
//
//   REGRA FUNDAMENTAL (auto-reforço): uma Decision que confirmou uma Oferta
//   significa "o operador concordou com a sugestão" — nunca "a realidade
//   confirmou a sugestão". Ela permanece rastreável (o Journal é imutável),
//   mas é DESCONTADA como evidência: consumida pela Oferta.
//
//   EVIDÊNCIAS VÁLIDAS: Decisions sem Oferta (o suporte independente) e
//   Outcomes `modified` (o operador contrariou a sugestão — contradição
//   observada; alimenta o Pattern concorrente via Detector, NUNCA é
//   descontada). Outcomes `pending` não são evidência de nada.
//
//   SUBIR ACIMA DE `consistente` ESTÁ ESTRUTURALMENTE BLOQUEADO: nenhum
//   limiar acima de consistente foi congelado (002 §7 e 005 §9 dizem "Outcomes
//   confirmam"/"confirmação sustentada" SEM números). Inventar um limiar aqui
//   seria heurística — proibida por esta própria missão. Elevar exigirá
//   política canônica via ADR; até lá, os movimentos possíveis são MANTER e
//   REBAIXAR (por desconto), e a projeção o declara em toda evolução.
//
// Determinismo: sem relógio, sem NOW, sem recência, sem pesos — função pura do
// conjunto {Patterns materializados, Outcomes projetados}. Nunca persiste,
// nunca altera Pattern/Confidence/Journal.

import {
  confidenceDe,
  estadoDoSlot,
  type ConfidencePadrao,
  type Padrao,
} from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import { reposLeituraPadrao, type ReposDeLeitura } from "./pattern-browser.ts";
import { projetarOutcomes } from "./outcome-projection.ts";
import type { ReposObservacao } from "./offer-observation.ts";

/** Nota fixa — presente em TODA evolução (transparência estrutural). */
export const NOTA_ELEVACAO_BLOQUEADA =
  "Elevação acima de 'consistente' está estruturalmente bloqueada: nenhum limiar " +
  "acima de consistente foi congelado (RFC-AIL-002 §7 / RFC-AIL-005 §9 não fixam números). " +
  "Definir um seria heurística; exigirá política canônica via ADR.";

export type MotivoEvolucao =
  | "mantida_sem_outcomes" // nenhum Outcome toca este Pattern
  | "mantida_por_evidencia_independente" // o desconto não altera o nível
  | "rebaixada_por_desconto_de_auto_reforco"; // sem as confirmações, o nível cai

/** A reavaliação de UM Pattern — somente leitura, jamais persistida. */
export interface ConfidenceEvolution {
  patternId: string;
  empresa: string;
  slot: { contexto: string; campo: string };
  valor: string;
  confidenceAnterior: ConfidencePadrao; // a materializada (intocada)
  confidenceProjetada: ConfidencePadrao; // confidenceDe(suporte independente)
  motivo: MotivoEvolucao;
  /** Evidências que SUSTENTAM a reavaliação (origem rastreável). */
  evidenciasUtilizadas: {
    decisoesIndependentes: string[]; // suporte sem oferta
    outcomesModificados: string[]; // contradições observadas (outcomeIds)
  };
  /** Evidências deliberadamente DESCONTADAS, com o porquê. */
  evidenciasDescontadas: {
    decisionId: string;
    offerId: string;
    outcomeId: string;
    porque: "consumida_pela_oferta"; // confirmou a Oferta — não é independente
  }[];
  /** Suportes para auditoria do cálculo. */
  suporte: { total: number; independente: number };
  explanation: string;
}

/** Índice: decisionId → outcome confirmado que a consumiu (para o desconto). */
function indexarConsumidas(outcomes: readonly Outcome[]): Map<string, Outcome> {
  const m = new Map<string, Outcome>();
  for (const o of outcomes) {
    if (o.status === "confirmed" && o.decisionId) m.set(o.decisionId, o);
  }
  return m;
}

/** Suporte independente de um Pattern = decisões de suporte não-consumidas. */
function suporteIndependenteDe(
  p: Padrao,
  consumidas: Map<string, Outcome>
): { independentes: string[]; descontadas: ConfidenceEvolution["evidenciasDescontadas"] } {
  const independentes: string[] = [];
  const descontadas: ConfidenceEvolution["evidenciasDescontadas"] = [];
  for (const decisionId of p.decisoesDeSuporte) {
    const outcome = consumidas.get(decisionId);
    if (outcome && outcome.evidence.patternId === p.id) {
      descontadas.push({
        decisionId,
        offerId: outcome.offerId,
        outcomeId: outcome.outcomeId,
        porque: "consumida_pela_oferta",
      });
    } else {
      independentes.push(decisionId);
    }
  }
  return { independentes, descontadas };
}

/**
 * PURA E DETERMINÍSTICA: reavalia UM Pattern dado o conjunto de Patterns
 * materializados (para o slot) e os Outcomes projetados. Mesmos fatos →
 * mesmo resultado; ordem de entrada irrelevante.
 */
export function evoluirConfidence(
  pattern: Padrao,
  todosPadroes: readonly Padrao[],
  outcomes: readonly Outcome[]
): ConfidenceEvolution {
  const consumidas = indexarConsumidas(outcomes);
  const { independentes, descontadas } = suporteIndependenteDe(pattern, consumidas);

  // O slot também é reavaliado com suportes independentes — os concorrentes
  // passam pelo MESMO desconto (regra única, nenhum caso especial).
  const suportesDoSlot = todosPadroes
    .filter(
      (p) =>
        p.empresa === pattern.empresa &&
        p.contexto === pattern.contexto &&
        p.campo === pattern.campo
    )
    .map((p) => suporteIndependenteDe(p, consumidas).independentes.length);
  const slotIndependente = estadoDoSlot(suportesDoSlot);

  // Funções CONGELADAS do Detector — zero números novos.
  const confidenceProjetada = confidenceDe(independentes.length, slotIndependente);

  const modificados = outcomes
    .filter((o) => o.status === "modified" && o.evidence.patternId === pattern.id)
    .map((o) => o.outcomeId)
    .sort();

  const motivo: MotivoEvolucao =
    descontadas.length === 0 && modificados.length === 0
      ? "mantida_sem_outcomes"
      : confidenceProjetada === pattern.confidence
        ? "mantida_por_evidencia_independente"
        : "rebaixada_por_desconto_de_auto_reforco";

  const partes = [
    `Confidence materializada: "${pattern.confidence}" com ${pattern.ocorrencias} decisões de suporte.`,
    descontadas.length > 0
      ? `Descontadas ${descontadas.length} decisão(ões) consumida(s) por Oferta confirmada ` +
        `(${descontadas.map((d) => d.decisionId).join(", ")}): o operador concordou com a sugestão — ` +
        `a realidade não a confirmou.`
      : `Nenhuma decisão de suporte foi consumida por Oferta.`,
    `Suporte independente: ${independentes.length}. Regra aplicada: confidenceDe(suporte independente, ` +
      `slot independente) — as MESMAS funções congeladas do Detector (RFC-AIL-004 §4.3/§4.4). ` +
      `Resultado: "${confidenceProjetada}".`,
    modificados.length > 0
      ? `Contradições observadas: ${modificados.length} Outcome(s) modified (${modificados.join(", ")}) — ` +
        `o operador contrariou a sugestão; essa evidência alimenta o Pattern concorrente via Detector.`
      : `Nenhuma contradição observada via Outcome.`,
    NOTA_ELEVACAO_BLOQUEADA,
  ];

  return {
    patternId: pattern.id,
    empresa: pattern.empresa,
    slot: { contexto: pattern.contexto, campo: pattern.campo },
    valor: pattern.valorNovo,
    confidenceAnterior: pattern.confidence,
    confidenceProjetada,
    motivo,
    evidenciasUtilizadas: {
      decisoesIndependentes: [...independentes].sort(),
      outcomesModificados: modificados,
    },
    evidenciasDescontadas: [...descontadas].sort((a, b) => (a.decisionId < b.decisionId ? -1 : 1)),
    suporte: { total: pattern.ocorrencias, independente: independentes.length },
    explanation: partes.join(" "),
  };
}

/**
 * Reavalia todos os Patterns (opcionalmente por empresa). Consome apenas os
 * RESULTADOS das projeções existentes (Patterns materializados + Outcomes via
 * E5.1) — nada é recalculado, nada é escrito.
 */
export async function evoluirConfidences(
  empresa?: string,
  repos?: { leitura?: ReposDeLeitura; observacao?: ReposObservacao }
): Promise<ConfidenceEvolution[]> {
  const leitura = repos?.leitura ?? reposLeituraPadrao;
  const [padroes, outcomes] = await Promise.all([
    leitura.padroes.listar(),
    projetarOutcomes(empresa, repos?.observacao),
  ]);
  const alvo = empresa ? padroes.filter((p) => p.empresa === empresa) : padroes;
  return alvo.map((p) => evoluirConfidence(p, padroes, outcomes));
}
