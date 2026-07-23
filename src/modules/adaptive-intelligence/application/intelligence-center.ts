// Decision Intelligence Center — camada de COMPOSIÇÃO para a interface (E5.6).
//
// NÃO é uma projeção nova: é exatamente a mesma composição que o Analytics
// (E5.5) executa — cada fonte carregada UMA vez, resultados combinados com as
// funções puras já existentes (E5.1/E5.3/E5.4) — exposta num formato que a
// interface consome pronto. Nenhuma métrica nova, nenhum recálculo, nenhum
// estado próprio: a tela é uma representação visual das projeções; atualizar
// os fatos atualiza a projeção, que atualiza a interface.

import type { Padrao } from "../domain/pattern.ts";
import type { Outcome } from "../domain/outcome.ts";
import { evoluirConfidence, type ConfidenceEvolution } from "./confidence-evolution.ts";
import {
  avaliarPromocao,
  type PromotionReadiness,
} from "./promotion-readiness.ts";
import {
  montarAnalytics,
  type DecisionIntelligenceAnalytics,
} from "./intelligence-analytics.ts";
import { reposLeituraPadrao, visaoDe, type ReposDeLeitura, type VisaoPadrao } from "./pattern-browser.ts";
import { projetarOutcomes } from "./outcome-projection.ts";
import type { ReposObservacao } from "./offer-observation.ts";

/** A linha de um Pattern no Center — tudo proveniente das projeções. */
export interface PadraoNoCentro {
  padrao: VisaoPadrao;
  evolution: ConfidenceEvolution; // E5.3
  readiness: PromotionReadiness; // E5.4
  outcomes: Outcome[]; // E5.1 (do Pattern)
}

/** A visão completa do Center — analytics + detalhamento por Pattern. */
export interface VisaoDoCentro {
  analytics: DecisionIntelligenceAnalytics; // E5.5, intocado
  padroes: PadraoNoCentro[];
}

/** PURA: compõe a visão a partir dos resultados já computados. */
export function comporVisaoDoCentro(
  padroes: readonly Padrao[],
  todosPadroes: readonly Padrao[],
  outcomes: readonly Outcome[]
): VisaoDoCentro {
  const linhas: PadraoNoCentro[] = padroes.map((p) => {
    const evolution = evoluirConfidence(p, todosPadroes, outcomes);
    return {
      padrao: visaoDe(p),
      evolution,
      readiness: avaliarPromocao(p, evolution, outcomes),
      outcomes: outcomes.filter((o) => o.evidence.patternId === p.id),
    };
  });
  return {
    analytics: montarAnalytics(
      padroes,
      outcomes,
      linhas.map((l) => l.evolution),
      linhas.map((l) => l.readiness)
    ),
    padroes: linhas,
  };
}

/** Carrega cada fonte UMA vez e compõe (empresa opcional). */
export async function carregarVisaoDoCentro(
  empresa?: string,
  repos?: { leitura?: ReposDeLeitura; observacao?: ReposObservacao }
): Promise<VisaoDoCentro> {
  const leitura = repos?.leitura ?? reposLeituraPadrao;
  const [todos, outcomes] = await Promise.all([
    leitura.padroes.listar(),
    projetarOutcomes(empresa, repos?.observacao),
  ]);
  const alvo = empresa ? todos.filter((p) => p.empresa === empresa) : todos;
  return comporVisaoDoCentro(alvo, todos, outcomes);
}

/** O detalhe de UM Pattern no Center (null se não existir). */
export async function carregarPadraoNoCentro(
  patternId: string,
  repos?: { leitura?: ReposDeLeitura; observacao?: ReposObservacao }
): Promise<PadraoNoCentro | null> {
  const leitura = repos?.leitura ?? reposLeituraPadrao;
  const [todos, outcomes] = await Promise.all([
    leitura.padroes.listar(),
    projetarOutcomes(undefined, repos?.observacao),
  ]);
  const padrao = todos.find((p) => p.id === patternId);
  if (!padrao) return null;
  return comporVisaoDoCentro([padrao], todos, outcomes).padroes[0];
}
