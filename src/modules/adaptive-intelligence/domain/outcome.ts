// Outcome — a PROJEÇÃO do que aconteceu depois de uma Oferta (E5.1).
//
// Outcome NÃO é fato: é derivação determinística de dois logs imutáveis
// (Offer Ledger × Decision Journal), via Offer Observation (E5.0). NUNCA é
// persistido, NUNCA escreve, NUNCA altera Confidence/Pattern/Knowledge —
// materializa a definição congelada da RFC-AIL-002 §3.6 ("o Outcome é a
// leitura dessa relação") e da ADR-001 ("ledger de Outcomes" = projeção).
//
// ESTADOS: apenas os sustentados pelos fatos atuais (limites da E5.0):
//   pending    sem Decision posterior — SEM janela: pending nunca expira por
//              tempo (relógio/recência = heurística; deferida 004 §6.4)
//   confirmed  Decision posterior com o valor oferecido
//   modified   Decision posterior com outro valor
// NÃO existem (exigem fatos que ainda não são registrados — documentado):
//   rejected   ("Remover sugestão" não registra fato)
//   expired    (não há política de tempo)
//   ignored    (indistinguível de pending sem fato de exibição/engajamento)
//
// REGRA DO AUTO-REFORÇO (arquitetural, desde já): a aceitação de uma Oferta
// NUNCA constitui evidência independente — um Outcome `confirmed` carrega o
// decisionId exatamente para que a E5.3 desconte essa Decision ao evoluir a
// Confidence. O Outcome apenas descreve; jamais ensina.
//
// DETERMINISMO: outcomeId derivado do offerId (1 oferta → 1 outcome);
// nenhum relógio, nenhum NOW() — todo tempo vem dos próprios fatos.

import type { ObservacaoDaOferta } from "../application/offer-observation.ts";

export type StatusOutcome = "pending" | "confirmed" | "modified";

/** O Outcome projetado — somente leitura; cada campo com origem nos fatos. */
export interface Outcome {
  /** Determinístico: derivado do offerId (mesmos fatos → mesmo id). */
  readonly outcomeId: string;
  readonly offerId: string;
  readonly empresaId: string;
  readonly slot: { readonly contexto: string; readonly campo: string };
  readonly entidade: { readonly tipo: string; readonly id: string } | null;
  readonly status: StatusOutcome;
  /** A Decision que respondeu (null em pending). */
  readonly decisionId: string | null;
  /** Quem respondeu (rotulado; null em pending). */
  readonly author: string | null;
  readonly respondedAt: string | null;
  readonly responseTimeMs: number | null;
  /** A evidência bruta que sustenta o status — reconstruível dos logs. */
  readonly evidence: {
    readonly valorOferecido: string;
    readonly valorDecidido: string | null;
    readonly diferenca: "nenhuma" | "valor_alterado" | null; // null em pending
    readonly patternId: string;
    readonly confidenceNaOferta: string;
    readonly respostasSubsequentes: number;
  };
  /** POR QUE este status — texto derivado exclusivamente dos fatos. */
  readonly explanation: string;
}

/** outcomeId determinístico: 1 oferta → 1 outcome, sem crypto, reversível. */
export function outcomeIdDe(offerId: string): string {
  return `otc:${offerId}`;
}

const STATUS_POR_CLASSE = {
  sem_resposta: "pending",
  respondida_igual: "confirmed",
  respondida_diferente: "modified",
} as const satisfies Record<ObservacaoDaOferta["classe"], StatusOutcome>;

function explicar(obs: ObservacaoDaOferta, status: StatusOutcome): string {
  const o = obs.oferta;
  if (status === "pending") {
    return (
      `Nenhuma Decision posterior no alvo da oferta (${o.contexto}·${o.campo}` +
      `${o.entidade ? `, ${o.entidade.tipo} ${o.entidade.id}` : ""}) no conjunto de fatos ` +
      `projetado. Sem janela temporal: pending nunca expira por relógio (recência deferida).`
    );
  }
  const r = obs.resposta!;
  if (status === "confirmed") {
    return (
      `${r.autor} decidiu exatamente o valor oferecido ("${o.valorOferecido}") ` +
      `${r.tempoAteRespostaMs} ms após a oferta (Decision ${r.decisionId}). ` +
      `Regra do auto-reforço: esta Decision seguiu a oferta — NÃO é evidência independente (E5.3 a descontará).`
    );
  }
  return (
    `${r.autor} decidiu "${r.valorNovo}" no lugar do oferecido ("${o.valorOferecido}") ` +
    `${r.tempoAteRespostaMs} ms após a oferta (Decision ${r.decisionId}) — o operador modificou a oferta.`
  );
}

/**
 * PURA E DETERMINÍSTICA: Observação (E5.0) → Outcome. Mesmos fatos → mesmo
 * Outcome, sempre. Nenhum efeito colateral, nenhuma persistência.
 */
export function outcomeDe(obs: ObservacaoDaOferta): Outcome {
  const status = STATUS_POR_CLASSE[obs.classe];
  const o = obs.oferta;
  const r = obs.resposta;
  return {
    outcomeId: outcomeIdDe(o.id),
    offerId: o.id,
    empresaId: o.empresa,
    slot: { contexto: o.contexto, campo: o.campo },
    entidade: o.entidade,
    status,
    decisionId: r?.decisionId ?? null,
    author: r?.autor ?? null,
    respondedAt: r?.quando ?? null,
    responseTimeMs: r?.tempoAteRespostaMs ?? null,
    evidence: {
      valorOferecido: o.valorOferecido,
      valorDecidido: r?.valorNovo ?? null,
      diferenca: r ? (status === "confirmed" ? "nenhuma" : "valor_alterado") : null,
      patternId: o.patternId,
      confidenceNaOferta: o.confidenceUtilizada,
      respostasSubsequentes: obs.respostasSubsequentes,
    },
    explanation: explicar(obs, status),
  };
}
