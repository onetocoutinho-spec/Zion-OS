// Intelligence Analytics (E5.5) — a saúde da Decision Intelligence, mensurável.
//
// Inaugura a camada OPERACIONAL: o comportamento da plataforma torna-se
// observável para quem a mantém, sem consultar projeção por projeção.
//
//   Analytics nunca altera conhecimento. Nunca produz fatos. Apenas MEDE.
//
// Contratos: consome exclusivamente os RESULTADOS das projeções existentes
// (Patterns materializados, Outcomes E5.1, Confidence Evolution E5.3,
// Promotion Readiness E5.4) — cada fonte carregada UMA vez e composta com as
// mesmas funções puras dessas camadas (nada recalculado por fórmula própria).
// Determinístico: sem relógio, sem NOW, sem pesos, sem tendências, sem
// previsão — e SAÚDE SEM NOTA: o Health é uma lista de fatos, nunca um score.
// Toda métrica declara a própria metodologia (como foi calculada, de quais
// projeções, sobre quais fatos). Serializável (JSON puro), jamais persistido.

import type { Padrao } from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import { evoluirConfidence, type ConfidenceEvolution } from "./confidence-evolution.ts";
import {
  avaliarPromocao,
  type BloqueioPromocao,
  type PromotionReadiness,
} from "./promotion-readiness.ts";
import { reposLeituraPadrao, type ReposDeLeitura } from "./pattern-browser.ts";
import { projetarOutcomes } from "./outcome-projection.ts";
import type { ReposObservacao } from "./offer-observation.ts";

/** O painel analítico — somente leitura, serializável, jamais persistido. */
export interface DecisionIntelligenceAnalytics {
  patterns: {
    total: number;
    consistentes: number;
    disputados: number;
    /** Sobreviventes ao desconto de auto-reforço (E5.3: projetada === atual). */
    sobreviventesAposEvolution: number;
  };
  offers: {
    emitidas: number; // |ofertas| = |outcomes| (1 oferta → 1 outcome)
    respondidas: number; // confirmed + modified
    pendentes: number; // pending
  };
  outcomes: {
    confirmed: number;
    modified: number;
    pending: number;
  };
  confidence: {
    mantidas: number; // motivo mantida_* (com ou sem outcomes)
    rebaixadas: number; // rebaixada_por_desconto_de_auto_reforco
    estaveis: number; // confidenceProjetada === confidenceAtual
  };
  promotionReadiness: {
    estruturalmenteElegiveis: number;
    bloqueadas: number;
    /** Bloqueios agrupados por motivo (o da ADR-002 = total, honestamente). */
    bloqueiosPorMotivo: { motivo: BloqueioPromocao; quantidade: number }[];
  };
  /** Saúde SEM nota: apenas fatos, na linguagem do mantenedor. */
  health: {
    fatos: string[];
    principaisBloqueios: { motivo: BloqueioPromocao; quantidade: number }[];
  };
  /** Como cada seção foi calculada — a origem nunca é escondida. */
  metodologia: Record<
    "patterns" | "offers" | "outcomes" | "confidence" | "promotionReadiness" | "health",
    string
  >;
}

const METODOLOGIA: DecisionIntelligenceAnalytics["metodologia"] = {
  patterns:
    "Contagens diretas sobre a projeção materializada `padroes` (Detector, 004); 'sobreviventes' = Confidence Evolution (E5.3) com confidenceProjetada === confidenceAtual.",
  offers:
    "1 oferta → 1 outcome (E5.1): emitidas = |outcomes|; respondidas = confirmed+modified; pendentes = pending. Fonte: Offer Ledger × Journal via E5.0/E5.1.",
  outcomes: "Contagem por status da Outcome Projection (E5.1) — jamais persistida.",
  confidence:
    "Motivos da Confidence Evolution (E5.3): mantidas = mantida_*; rebaixadas = rebaixada_por_desconto_de_auto_reforco; estáveis = projetada === atual.",
  promotionReadiness:
    "Promotion Readiness (E5.4): elegíveis = único bloqueio restante é a ADR-002; bloqueios agrupados por motivo (o da ADR-002 vale para todos, por construção).",
  health:
    "Fatos selecionados das seções acima — sem nota, sem score, sem pesos, sem tendência.",
};

/**
 * PURA E DETERMINÍSTICA: monta o painel a partir dos resultados já computados
 * das projeções. Mesmos fatos → mesmo Analytics.
 */
export function montarAnalytics(
  padroes: readonly Padrao[],
  outcomes: readonly Outcome[],
  evolucoes: readonly ConfidenceEvolution[],
  avaliacoes: readonly PromotionReadiness[]
): DecisionIntelligenceAnalytics {
  const consistentes = padroes.filter((p) => p.confidence === "consistente").length;
  const disputados = padroes.filter((p) => p.slotEstado === "em_disputa").length;
  const sobreviventes = evolucoes.filter(
    (e) => e.confidenceProjetada === e.confidenceAnterior
  ).length;

  const confirmed = outcomes.filter((o) => o.status === "confirmed").length;
  const modified = outcomes.filter((o) => o.status === "modified").length;
  const pending = outcomes.filter((o) => o.status === "pending").length;

  const rebaixadas = evolucoes.filter(
    (e) => e.motivo === "rebaixada_por_desconto_de_auto_reforco"
  ).length;

  const elegiveis = avaliacoes.filter((a) => a.estruturalmenteElegivel).length;

  // Bloqueios agrupados por motivo — ordenados por quantidade desc, depois
  // pelo nome (desempate determinístico).
  const porMotivo = new Map<BloqueioPromocao, number>();
  for (const a of avaliacoes) {
    for (const b of a.bloqueios) porMotivo.set(b, (porMotivo.get(b) ?? 0) + 1);
  }
  const bloqueiosPorMotivo = [...porMotivo.entries()]
    .map(([motivo, quantidade]) => ({ motivo, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade || (a.motivo < b.motivo ? -1 : 1));

  const fatos = [
    `Patterns materializados: ${padroes.length} (${consistentes} consistentes, ${disputados} em disputa).`,
    `Sobreviventes ao desconto de auto-reforço: ${sobreviventes} de ${evolucoes.length}.`,
    `Ofertas emitidas: ${outcomes.length} (${confirmed + modified} respondidas, ${pending} pendentes).`,
    `Outcomes: ${confirmed} confirmed · ${modified} modified · ${pending} pending.`,
    `Estruturalmente prontos para promoção: ${elegiveis} (a decisão aguarda a ADR-002).`,
  ];

  return {
    patterns: {
      total: padroes.length,
      consistentes,
      disputados,
      sobreviventesAposEvolution: sobreviventes,
    },
    offers: {
      emitidas: outcomes.length,
      respondidas: confirmed + modified,
      pendentes: pending,
    },
    outcomes: { confirmed, modified, pending },
    confidence: {
      mantidas: evolucoes.length - rebaixadas,
      rebaixadas,
      estaveis: sobreviventes,
    },
    promotionReadiness: {
      estruturalmenteElegiveis: elegiveis,
      bloqueadas: avaliacoes.length - elegiveis,
      bloqueiosPorMotivo,
    },
    health: { fatos, principaisBloqueios: bloqueiosPorMotivo.slice(0, 3) },
    metodologia: METODOLOGIA,
  };
}

/** Carrega cada fonte UMA vez e compõe com as funções puras das camadas. */
async function carregarEMontar(
  empresa?: string,
  repos?: { leitura?: ReposDeLeitura; observacao?: ReposObservacao }
): Promise<DecisionIntelligenceAnalytics> {
  const leitura = repos?.leitura ?? reposLeituraPadrao;
  const [todos, outcomes] = await Promise.all([
    leitura.padroes.listar(),
    projetarOutcomes(empresa, repos?.observacao),
  ]);
  const padroes = empresa ? todos.filter((p) => p.empresa === empresa) : todos;
  const evolucoes = padroes.map((p) => evoluirConfidence(p, todos, outcomes));
  const avaliacoes = padroes.map((p, i) => avaliarPromocao(p, evolucoes[i], outcomes));
  return montarAnalytics(padroes, outcomes, evolucoes, avaliacoes);
}

/** O painel completo da plataforma. */
export async function gerarAnalytics(
  repos?: { leitura?: ReposDeLeitura; observacao?: ReposObservacao }
): Promise<DecisionIntelligenceAnalytics> {
  return carregarEMontar(undefined, repos);
}

/** O painel de UMA empresa (tenant). */
export async function gerarAnalyticsEmpresa(
  empresa: string,
  repos?: { leitura?: ReposDeLeitura; observacao?: ReposObservacao }
): Promise<DecisionIntelligenceAnalytics> {
  return carregarEMontar(empresa, repos);
}
