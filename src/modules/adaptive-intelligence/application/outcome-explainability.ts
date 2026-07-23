// Outcome Explainability (E5.2) — a superfície oficial de explicação.
//
// VISUALIZAÇÃO, nunca interpretação: nenhuma informação é criada aqui — tudo
// já existe na Oferta (fato), na Observação (E5.0) e no Outcome (E5.1). Este
// módulo apenas REVELA a cadeia de evidências num objeto de leitura
// SERIALIZÁVEL (JSON puro; zero React, zero apresentação, zero heurística).
//
// Nota de pureza sobre a API: a missão pede `explicarOutcome(outcome)` puro —
// mas parte das respostas obrigatórias (contrato vigente, autor da oferta,
// quando foi criada) vive na OFERTA, não no Outcome. Pureza exige receber os
// fatos como entrada: `explicarOutcome(outcome, oferta)`. A variante de
// carregamento (`explicarOutcomes`) faz o join pelos logs — uma listagem de
// cada, nada recalculado além da própria projeção (E5.1, a fonte sancionada).

import type { Oferta } from "../domain/offer.ts";
import { outcomeDe, type Outcome } from "../domain/outcome.ts";
import { observarOfertas, type ReposObservacao } from "./offer-observation.ts";

/** Texto FIXO do auto-reforço — derivado do status, jamais recalculado. */
export const NOTA_AUTO_REFORCO =
  "Esta confirmação representa apenas que a Decision seguiu a Offer. " +
  "Ela não constitui evidência independente. " +
  "A evolução da Confidence será tratada exclusivamente pelo E5.3.";

/** A explicação completa de um Outcome — serializável, cada campo com origem. */
export interface OutcomeExplanation {
  outcomeId: string;
  status: Outcome["status"];
  /** ORIGEM: a Oferta que originou este Outcome (fato do Offer Ledger). */
  origem: {
    offerId: string;
    criadaEm: string; // ofertas.oferecida_em
    autorDaOferta: string; // quem a produziu (o sistema, assinado)
    versaoContrato: string; // contrato de elegibilidade vigente
    patternId: string;
    confidenceCongelada: string; // a confidence NO INSTANTE da oferta
    origemExplicacao: string;
    /** Assinatura versionada (E5.9) — null = oferta pré-versionamento. */
    versaoEngine: string | null;
    versaoConfidence: string | null;
    versaoExplainability: string | null;
  };
  /** RESPOSTA: a Decision que respondeu (null quando pending). */
  resposta: {
    decisionId: string;
    autor: string;
    quando: string;
    tempoAteRespostaMs: number;
  } | null;
  /** COMPARAÇÃO: oferecido × decidido. */
  comparacao: {
    valorOferecido: string;
    valorDecidido: string | null;
    iguais: boolean | null; // null quando pending
    diferenca: "nenhuma" | "valor_alterado" | null;
  };
  /** EVIDÊNCIAS: a cadeia Offer → Observation → Outcome, nunca escondida. */
  cadeiaDeEvidencias: string[];
  /** AUTO-REFORÇO: presente SÓ em confirmed — derivado do próprio Outcome. */
  notaAutoReforco: string | null;
  /** O porquê do status (a explanation da projeção E5.1, intocada). */
  statusExplicado: string;
}

/**
 * PURA: monta a explicação de um Outcome a partir dos fatos que o originaram.
 * Devolve null se a Oferta não corresponde ao Outcome ("Offer ausente" —
 * uma explicação sem a origem não pode existir).
 */
export function explicarOutcome(outcome: Outcome, oferta: Oferta): OutcomeExplanation | null {
  if (oferta.id !== outcome.offerId) return null;

  const cadeia = [
    `Offer ${oferta.id}: o sistema (${oferta.autorDaOferta}) ofereceu "${oferta.valorOferecido}" ` +
      `em ${oferta.oferecidaEm} sob o contrato ${oferta.versaoContrato} ` +
      `(Pattern ${oferta.patternId}, confidence "${oferta.confidenceUtilizada}" no instante).`,
    outcome.decisionId
      ? `Observation (E5.0): a primeira Decision posterior no alvo foi ${outcome.decisionId}, ` +
        `de ${outcome.author}, em ${outcome.respondedAt}` +
        (outcome.evidence.respostasSubsequentes > 0
          ? ` (+${outcome.evidence.respostasSubsequentes} subsequente(s)).`
          : ".")
      : "Observation (E5.0): nenhuma Decision posterior no alvo da oferta no conjunto de fatos projetado.",
    `Outcome (E5.1): status "${outcome.status}" — ${outcome.explanation}`,
  ];

  return {
    outcomeId: outcome.outcomeId,
    status: outcome.status,
    origem: {
      offerId: oferta.id,
      criadaEm: oferta.oferecidaEm,
      autorDaOferta: oferta.autorDaOferta,
      versaoContrato: oferta.versaoContrato,
      patternId: oferta.patternId,
      confidenceCongelada: oferta.confidenceUtilizada,
      origemExplicacao: oferta.origemExplicacao,
      versaoEngine: oferta.versaoEngine ?? null,
      versaoConfidence: oferta.versaoConfidence ?? null,
      versaoExplainability: oferta.versaoExplainability ?? null,
    },
    resposta:
      outcome.decisionId && outcome.author && outcome.respondedAt !== null
        ? {
            decisionId: outcome.decisionId,
            autor: outcome.author,
            quando: outcome.respondedAt,
            tempoAteRespostaMs: outcome.responseTimeMs ?? 0,
          }
        : null,
    comparacao: {
      valorOferecido: outcome.evidence.valorOferecido,
      valorDecidido: outcome.evidence.valorDecidido,
      iguais: outcome.evidence.diferenca === null ? null : outcome.evidence.diferenca === "nenhuma",
      diferenca: outcome.evidence.diferenca,
    },
    cadeiaDeEvidencias: cadeia,
    notaAutoReforco: outcome.status === "confirmed" ? NOTA_AUTO_REFORCO : null,
    statusExplicado: outcome.explanation,
  };
}

/**
 * Explica todos os Outcomes (opcionalmente por empresa): uma listagem de cada
 * log via E5.0, projeção via E5.1, montagem pura — nada além é consultado.
 */
export async function explicarOutcomes(
  empresa?: string,
  repos?: ReposObservacao
): Promise<OutcomeExplanation[]> {
  const observacoes = await observarOfertas(empresa, repos);
  return observacoes
    .map((obs) => explicarOutcome(outcomeDe(obs), obs.oferta))
    .filter((e): e is OutcomeExplanation => e !== null);
}
