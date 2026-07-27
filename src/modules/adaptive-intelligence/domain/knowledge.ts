// Knowledge — o agregado institucional (E5.10a, executa a ADR-002).
//
// ESTA IMPLEMENTAÇÃO NÃO REINTERPRETA A POLÍTICA. Cada função cita a questão
// da ADR-002 que executa. Knowledge é um AGREGADO PRÓPRIO (Q1): fatos
// append-only de maturação que referenciam o Pattern e congelam a fotografia
// da evidência; o estado vigente é PROJEÇÃO sobre os fatos.
//
//   Q2  promovível  = estruturalmente elegível (E5.4) ∧ respondidos ≥ 2
//                     (APÓS a última promoção — a régua recomeça a cada
//                     versão) ∧ a última resposta do campo é `confirmed`.
//                     Tempo NÃO participa (por eventos, nunca calendário).
//   Q3  promoção HÍBRIDA: o sistema propõe (esta projeção), o humano promove
//       (fato assinado — application layer). Automática não existe.
//   Q5  rebaixamento por FATO; o sistema SINALIZA (sobContradicao), nunca
//       rebaixa.
//   Q7  cada promoção é uma VERSÃO imutável; vigente = a mais recente
//       não-rebaixada.
//
// Tipos e funções PURAS: sem I/O, sem relógio, sem heurística.

import type { Outcome } from "./outcome.ts";
import type { PromotionReadiness } from "../application/promotion-readiness.ts";

/** A política sob a qual todo fato é produzido (gravada no fato — Q9). */
export const VERSAO_POLITICA_MATURACAO = "ADR-002 v1";

/** Limiar de campo da ADR-002 Q2 — o MESMO número canônico da 004 §4.3. */
export const MINIMO_RESPONDIDOS = 2;

/** A fotografia congelada no instante do fato (Q7/Q9). */
export interface FotografiaMaturacao {
  confidenceNoInstante: string;
  suporteIndependente: number;
  decisoesIndependentes: readonly string[];
  outcomesConsiderados: readonly string[]; // outcomeIds respondidos considerados
  ultimoOutcomeStatus: string | null;
  readinessBloqueios: readonly string[];
}

/** O FATO append-only de maturação (o gêmeo institucional da Oferta). */
export interface FatoMaturacao {
  readonly id: string;
  readonly patternId: string;
  readonly empresa: string;
  readonly contexto: string;
  readonly campo: string;
  readonly valor: string;
  readonly tipo: "promocao" | "rebaixamento";
  /** promocao: a versão criada; rebaixamento: a versão rebaixada. */
  readonly versao: number;
  /** Quem assinou — humano, jamais vazio (Q3). */
  readonly autorHumano: string;
  readonly motivo: string;
  readonly fotografia: FotografiaMaturacao;
  readonly versaoPolitica: string;
  readonly ocorridoEm: string;
}

/** O estado do Knowledge de um Pattern — PROJEÇÃO sobre os fatos (Q1/Q7). */
export interface EstadoConhecimento {
  situacao: "nenhum" | "vigente" | "rebaixado";
  /** A versão vigente (null quando não há). */
  versaoVigente: number | null;
  /** O fato de promoção vigente (null quando não há). */
  promocaoVigente: FatoMaturacao | null;
  /** Histórico completo, do mais recente ao mais antigo. */
  historico: FatoMaturacao[];
}

/** Uma condição objetiva da promovibilidade, com evidência citável. */
export interface CondicaoPromocao {
  condicao: string;
  ok: boolean;
  evidencia: string;
}

/**
 * Precedência causal no empate (Q7): rebaixar exige uma promoção VIGENTE e copia
 * a versão dela — logo, para a MESMA versão, a promoção é sempre causalmente
 * anterior ao rebaixamento. Quando instante e versão empatam, é esta ordem que
 * vale; o id (aleatório em produção) jamais decide causalidade.
 */
const PRECEDENCIA_NO_EMPATE: Record<FatoMaturacao["tipo"], number> = { promocao: 0, rebaixamento: 1 };

function ordenar(fatos: readonly FatoMaturacao[]): FatoMaturacao[] {
  // Determinístico: por instante do fato; empate pela versão, pela precedência
  // causal do tipo e, por fim, pelo id (desempate estável, nunca causal).
  return [...fatos].sort((a, b) =>
    a.ocorridoEm < b.ocorridoEm ? -1 : a.ocorridoEm > b.ocorridoEm ? 1
      : a.versao - b.versao
        || PRECEDENCIA_NO_EMPATE[a.tipo] - PRECEDENCIA_NO_EMPATE[b.tipo]
        || (a.id < b.id ? -1 : 1)
  );
}

/** PURA (Q7): vigente = a promoção mais recente sem rebaixamento posterior. */
export function estadoConhecimento(fatos: readonly FatoMaturacao[]): EstadoConhecimento {
  const cronologia = ordenar(fatos);
  const ultimo = cronologia[cronologia.length - 1] ?? null;
  const historico = [...cronologia].reverse();
  if (!ultimo) return { situacao: "nenhum", versaoVigente: null, promocaoVigente: null, historico };
  if (ultimo.tipo === "promocao") {
    return { situacao: "vigente", versaoVigente: ultimo.versao, promocaoVigente: ultimo, historico };
  }
  return { situacao: "rebaixado", versaoVigente: null, promocaoVigente: null, historico };
}

/** PURA: a próxima versão de promoção (v1, v2, … — Q7). */
export function proximaVersao(fatos: readonly FatoMaturacao[]): number {
  return Math.max(0, ...fatos.filter((f) => f.tipo === "promocao").map((f) => f.versao)) + 1;
}

/**
 * PURA (Q2): o veredito de promovibilidade — as TRÊS condições da ADR-002,
 * nenhuma a mais. A régua de campo RECOMEÇA após a última promoção
 * (mitigação "inflação de versões" — ADR-002 §Riscos).
 */
export function verificarPromovibilidade(
  readiness: PromotionReadiness,
  outcomesDoPattern: readonly Outcome[],
  fatosAnteriores: readonly FatoMaturacao[]
): { promovivel: boolean; condicoes: CondicaoPromocao[] } {
  const ultimaPromocao = ordenar(fatosAnteriores)
    .filter((f) => f.tipo === "promocao")
    .pop();
  const respondidos = outcomesDoPattern
    .filter((o) => o.status !== "pending" && o.respondedAt !== null)
    .filter((o) => !ultimaPromocao || (o.respondedAt as string) > ultimaPromocao.ocorridoEm)
    .sort((a, b) => ((a.respondedAt as string) < (b.respondedAt as string) ? -1 : 1));
  const ultimo = respondidos[respondidos.length - 1] ?? null;

  const condicoes: CondicaoPromocao[] = [
    {
      condicao: "estruturalmente elegível (E5.4)",
      ok: readiness.estruturalmenteElegivel,
      evidencia: readiness.estruturalmenteElegivel
        ? "Promotion Readiness sem bloqueios além da política (agora decidida — ADR-002)"
        : `bloqueios: ${readiness.bloqueios.join(", ")}`,
    },
    {
      condicao: `Outcomes respondidos ≥ ${MINIMO_RESPONDIDOS}${ultimaPromocao ? " após a última promoção (a régua recomeça)" : ""}`,
      ok: respondidos.length >= MINIMO_RESPONDIDOS,
      evidencia: `${respondidos.length} respondido(s): ${respondidos.map((o) => o.outcomeId).join(", ") || "nenhum"}`,
    },
    {
      condicao: "a última resposta do campo é `confirmed` (confirmação sustentada — por ordem de fatos, sem janela)",
      ok: ultimo?.status === "confirmed",
      evidencia: ultimo
        ? `último respondido: ${ultimo.outcomeId} (${ultimo.status}, ${ultimo.respondedAt})`
        : "nenhum outcome respondido",
    },
  ];
  return { promovivel: condicoes.every((c) => c.ok), condicoes };
}

/**
 * PURA (Q5): o Knowledge vigente está SOB CONTRADIÇÃO quando o Pattern de
 * origem deixa de sustentar os critérios estruturais. O sistema SINALIZA —
 * jamais rebaixa; rebaixar é ato humano assinado.
 */
export function sobContradicao(
  estado: EstadoConhecimento,
  readiness: PromotionReadiness | null
): boolean {
  if (estado.situacao !== "vigente") return false;
  if (!readiness) return true; // Pattern de origem ausente (ex.: reprojeção) — sinalizar
  return !readiness.estruturalmenteElegivel;
}
