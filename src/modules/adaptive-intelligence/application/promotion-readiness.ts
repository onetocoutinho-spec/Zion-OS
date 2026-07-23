// Promotion Readiness (E5.4) — este Pattern está PRONTO para uma futura
// promoção? (Ele NÃO é promovido — a decisão é impossível até a ADR-002.)
//
// Camada de leitura pura que responde apenas PERGUNTAS OBJETIVAS, todas
// binárias (existência/igualdade) — ZERO limiares, pesos, percentuais, regras
// temporais ou heurísticas:
//
//   1. A confidence atual está no TOPO DA CONTAGEM? (= "consistente" — o topo
//      congelado da 004 §4.3; não é limiar novo, é o existente)
//   2. O slot está sem disputa? (estado materializado)
//   3. A confidence SOBREVIVE ao desconto de auto-reforço? (E5.3:
//      projetada === atual)
//   4. Existem Outcomes observados? (existência — o conhecimento já foi
//      devolvido ao campo alguma vez?)
//
// O QUE ESTA CAMADA NUNCA RESPONDE (dependências declaradas da ADR-002 —
// lacunas arquiteturais NÃO se resolvem com código):
//   - QUANTOS outcomes bastam ("suficiente" = limiar)
//   - O QUE conta como outcome independente (confirmed é influência — E5.3)
//   - O que é "confirmação sustentada" (002 §7 — sem número congelado)
//   - Qualquer política temporal/recência (deferida — 004 §6.4)
//
// Por isso TODO PromotionReadiness carrega o bloqueio permanente
// `decisao_de_promocao_indefinida_adr_002` — inclusive os estruturalmente
// elegíveis. "Estruturalmente elegível" significa exatamente: o ÚNICO
// bloqueio restante é a ausência da ADR-002.
//
// Determinístico (sem NOW/recência/pesos), jamais persistido, jamais altera
// projeção alguma. Fontes: Pattern Projection + Confidence Evolution (E5.3) +
// Outcome Projection (E5.1) — resultados consumidos, nunca recalculados.

import type { Padrao } from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import {
  evoluirConfidence,
  type ConfidenceEvolution,
} from "./confidence-evolution.ts";
import { reposLeituraPadrao, type ReposDeLeitura } from "./pattern-browser.ts";
import { projetarOutcomes } from "./outcome-projection.ts";
import type { ReposObservacao } from "./offer-observation.ts";

export type BloqueioPromocao =
  | "confidence_abaixo_do_topo_da_contagem" // ≠ consistente (topo congelado)
  | "slot_em_disputa"
  | "confidence_nao_sobrevive_ao_desconto" // E5.3 rebaixou (auto-reforço)
  | "sem_outcomes_observados" // nunca foi devolvido ao campo
  | "decisao_de_promocao_indefinida_adr_002"; // permanente até a ADR-002

/** As perguntas que SÓ a ADR-002 pode responder — dependências declaradas. */
export const DEPENDENCIAS_ADR_002: readonly string[] = [
  "Quantos Outcomes bastam para sustentar uma promoção (qualquer quantidade é limiar).",
  "O que conta como Outcome INDEPENDENTE (confirmed é influência observada — E5.3).",
  "O que é 'confirmação sustentada' (RFC-AIL-002 §7 não congelou número).",
  "Se/como o tempo participa (política de recência deferida — RFC-AIL-004 §6.4).",
];

/** A avaliação de prontidão de UM Pattern — somente leitura, jamais persistida. */
export interface PromotionReadiness {
  patternId: string;
  empresaId: string;
  slot: { contexto: string; campo: string };
  valor: string;
  confidenceAtual: Padrao["confidence"];
  confidenceProjetada: Padrao["confidence"]; // pós-E5.3
  confidenceEstavel: boolean; // projetada === atual
  outcomesObservados: number;
  outcomesConfirmados: number; // influência observada — nunca evidência
  outcomesModificados: number; // contradições observadas
  outcomesPendentes: number;
  decisionsIndependentes: string[]; // suporte que existiria sem sugestão alguma
  disputas: boolean;
  /** true ⟺ o ÚNICO bloqueio restante é a ausência da ADR-002. */
  estruturalmenteElegivel: boolean;
  bloqueios: BloqueioPromocao[];
  /** Fatos que sustentam a avaliação (afirmações rastreáveis). */
  evidencias: string[];
  /** As lacunas que pertencem à ADR-002 — nunca preenchidas com código. */
  dependenciasAdr002: readonly string[];
  explanation: string;
}

/**
 * PURA E DETERMINÍSTICA: avalia a prontidão de UM Pattern a partir da sua
 * evolução (E5.3) e dos Outcomes projetados (E5.1). Nada é recalculado.
 */
export function avaliarPromocao(
  pattern: Padrao,
  evolution: ConfidenceEvolution,
  outcomes: readonly Outcome[]
): PromotionReadiness {
  const doPattern = outcomes.filter((o) => o.evidence.patternId === pattern.id);
  const confirmados = doPattern.filter((o) => o.status === "confirmed").length;
  const modificados = doPattern.filter((o) => o.status === "modified").length;
  const pendentes = doPattern.filter((o) => o.status === "pending").length;

  const disputas = pattern.slotEstado === "em_disputa";
  const confidenceEstavel = evolution.confidenceProjetada === pattern.confidence;

  const bloqueios: BloqueioPromocao[] = [];
  if (pattern.confidence !== "consistente") bloqueios.push("confidence_abaixo_do_topo_da_contagem");
  if (disputas) bloqueios.push("slot_em_disputa");
  if (!confidenceEstavel) bloqueios.push("confidence_nao_sobrevive_ao_desconto");
  if (doPattern.length === 0) bloqueios.push("sem_outcomes_observados");
  bloqueios.push("decisao_de_promocao_indefinida_adr_002"); // sempre — até a ADR existir

  const estruturalmenteElegivel =
    bloqueios.length === 1 && bloqueios[0] === "decisao_de_promocao_indefinida_adr_002";

  const evidencias = [
    `Confidence materializada "${pattern.confidence}" com ${pattern.ocorrencias} decisões de suporte (Pattern ${pattern.id}).`,
    `Após o desconto de auto-reforço (E5.3): "${evolution.confidenceProjetada}" com ${evolution.suporte.independente} decisões independentes (${evolution.evidenciasDescontadas.length} consumida(s) por oferta).`,
    `Slot ${pattern.slotEstado === "em_disputa" ? "EM DISPUTA" : `"${pattern.slotEstado}"`}.`,
    `Outcomes do Pattern: ${doPattern.length} observado(s) — ${confirmados} confirmed (influência, nunca evidência), ${modificados} modified (contradição observada), ${pendentes} pending.`,
  ];

  const explanation =
    evidencias.join(" ") +
    ` Veredito: ${
      estruturalmenteElegivel
        ? "ESTRUTURALMENTE ELEGÍVEL — todas as evidências verificáveis existem; o único bloqueio é a ausência da ADR-002."
        : `NÃO elegível — bloqueios: ${bloqueios.join(", ")}.`
    } A promoção em si permanece impossível: os critérios (quantidade/independência de outcomes, ` +
    `"confirmação sustentada", papel do tempo) pertencem à futura ADR-002 e não serão preenchidos com código.`;

  return {
    patternId: pattern.id,
    empresaId: pattern.empresa,
    slot: { contexto: pattern.contexto, campo: pattern.campo },
    valor: pattern.valorNovo,
    confidenceAtual: pattern.confidence,
    confidenceProjetada: evolution.confidenceProjetada,
    confidenceEstavel,
    outcomesObservados: doPattern.length,
    outcomesConfirmados: confirmados,
    outcomesModificados: modificados,
    outcomesPendentes: pendentes,
    decisionsIndependentes: evolution.evidenciasUtilizadas.decisoesIndependentes,
    disputas,
    estruturalmenteElegivel,
    bloqueios,
    evidencias,
    dependenciasAdr002: DEPENDENCIAS_ADR_002,
    explanation,
  };
}

/**
 * Avalia todos os Patterns (opcionalmente por empresa). Uma carga de cada
 * projeção sancionada; composição pura — nada recalculado, nada escrito.
 */
export async function avaliarPromocoes(
  empresa?: string,
  repos?: { leitura?: ReposDeLeitura; observacao?: ReposObservacao }
): Promise<PromotionReadiness[]> {
  const leitura = repos?.leitura ?? reposLeituraPadrao;
  const [padroes, outcomes] = await Promise.all([
    leitura.padroes.listar(),
    projetarOutcomes(empresa, repos?.observacao),
  ]);
  const alvo = empresa ? padroes.filter((p) => p.empresa === empresa) : padroes;
  return alvo.map((p) => avaliarPromocao(p, evoluirConfidence(p, padroes, outcomes), outcomes));
}
