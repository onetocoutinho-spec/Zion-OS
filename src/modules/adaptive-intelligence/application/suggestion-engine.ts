// Suggestion Engine (E4.2 · R-SE-1) — a primeira capability ATIVA da AIL.
//
// "Ativa" no sentido estrito: o sistema OFERECE um valor editável — e assina o
// fato. Continua sem decidir, sem aprender, sem delegar. Contratos:
//
//   ELEGIBILIDADE (PD-001, implementada SEM regra adicional):
//     ∃ Pattern do slot  ∧  confidence = consistente  ∧  slot CONSISTENTE
//     (sem disputa)  ∧  explicabilidade completa (evidências deriváveis)
//     ∧  registro de oferta DISPONÍVEL — sem o fato-da-oferta gravado, a
//     sugestão não é auditável e portanto NÃO EXISTE (ADR-001).
//
//   OFERTA (ADR-001): fato imutável, append-only, com a base CONGELADA no
//   instante (confidence/ocorrências do momento — a projeção evolui, a
//   auditoria não). O Outcome NÃO é calculado aqui: Outcome Readiness apenas —
//   a identidade da oferta (slot + entidade + valor + instante) é suficiente
//   para a futura projeção Outcomes = f(ofertas × Journal).
//
//   O Engine nunca escreve em campo do domínio, nunca bloqueia, nunca insiste.
//   Suggestions Are Evidence, Never Commands.

import { criarRepositorio } from "../../../lib/repositorio.ts";
import type { OfertaRow } from "../../../lib/supabase/database.types.ts";
import { type Oferta } from "../domain/offer.ts";
import { ASSINATURA_SUGGESTION_ENGINE } from "../domain/system-authorship.ts";
import { ofertaParaApp, ofertaParaBanco } from "../infrastructure/offer.mapper.ts";
import { reposLeituraPadrao, type ReposDeLeitura, type VisaoPadrao } from "./pattern-browser.ts";
import { localizarMemoria, type ContextoDeDecisao, type MemoriaContextual } from "./pattern-matching.ts";

const ORIGEM_EXPLICACAO = "explicarConfidence(RFC-AIL-004 §4.3/§4.4)";

const repoOfertas = criarRepositorio<Oferta, OfertaRow>({
  tabela: "ofertas",
  colecao: "ofertas",
  prefixoIdLocal: "ofr", // nunca usado: o OfferId nasce no domínio (R-INF-001)
  selecao: "*",
  paraApp: ofertaParaApp,
  paraBanco: ofertaParaBanco,
});

/** Porta de registro de ofertas (injetável em teste). Append-only: só salvar. */
export interface RegistroDeOfertas {
  salvar(oferta: Oferta): Promise<Oferta>;
}

export interface DepsEngine {
  leitura: ReposDeLeitura;
  ofertas: RegistroDeOfertas;
}

const depsPadrao: DepsEngine = { leitura: reposLeituraPadrao, ofertas: repoOfertas };

/** A Suggestion apresentável — toda informação derivável, nada inventado. */
export interface Sugestao {
  /** O valor oferecido (editável, removível, substituível — sempre). */
  valor: string;
  /** O Pattern utilizado — a porta da cadeia de explicabilidade (Browser). */
  patternId: string;
  confidence: VisaoPadrao["confidence"];
  ocorrencias: number;
  ultimaOcorrencia: string;
  ultimoAutor: string;
  /** POR QUE esta confidence (derivada dos limiares congelados). */
  explicacao: string;
  /** POR QUE a oferta é elegível (o contrato PD-001, citável). */
  motivoElegibilidade: string;
  /** O fato registrado — sem ele a Sugestao não existiria. */
  offerId: string;
}

/**
 * PURA: o veredito de elegibilidade sobre uma memória localizada — exatamente
 * o contrato PD-001/RFC-AIL-005 §6.1, nenhuma regra a mais.
 */
export function veredictoElegibilidade(memoria: MemoriaContextual): {
  elegivel: boolean;
  motivo: string;
} {
  if (!memoria.encontrada || !memoria.maisFrequente)
    return { elegivel: false, motivo: "sem Pattern no slot — silêncio (aditividade, RFC-AIL-005 §6.2)" };
  if (memoria.emDisputa)
    return { elegivel: false, motivo: "slot em disputa — nenhum concorrente sugere (RFC-AIL-004 §4.4)" };
  const top = memoria.maisFrequente;
  if (top.confidence !== "consistente")
    return {
      elegivel: false,
      motivo: `confidence "${top.confidence}" — sugerir exige "consistente" (RFC-AIL-005 §6.1)`,
    };
  if (top.slotEstado !== "consistente")
    return { elegivel: false, motivo: "slot não-CONSISTENTE (RFC-AIL-005 §6.1)" };
  if (top.decisoesDeSuporte.length === 0)
    return { elegivel: false, motivo: "sem evidências deriváveis — explicabilidade incompleta (RFC-AIL-002 §8)" };
  return {
    elegivel: true,
    motivo: `consistente (${top.ocorrencias} decisões) ∧ único valor recorrente do slot ∧ evidências deriváveis — RFC-AIL-005 §6.1 + PD-001`,
  };
}

/** PURA: constrói o fato-da-oferta a partir do contexto e do Pattern elegível. */
export function montarOferta(
  ctx: ContextoDeDecisao & { entidade?: { tipo: string; id: string } | null; correlacao?: string | null },
  top: VisaoPadrao,
  id: string,
  oferecidaEm: string
): Oferta {
  return {
    id,
    oferecidaEm,
    empresa: top.empresa,
    contexto: top.contexto,
    campo: top.campo,
    entidade: ctx.entidade ?? null,
    patternId: top.id,
    valorOferecido: top.valor,
    confidenceUtilizada: top.confidence,
    ocorrenciasNoMomento: top.ocorrencias,
    // Assinatura versionada do sistema (E5.9) — quem agiu E qual versão de quê.
    autorDaOferta: ASSINATURA_SUGGESTION_ENGINE.autor,
    versaoContrato: ASSINATURA_SUGGESTION_ENGINE.versaoContrato,
    origemExplicacao: ORIGEM_EXPLICACAO,
    versaoEngine: ASSINATURA_SUGGESTION_ENGINE.versaoEngine,
    versaoConfidence: ASSINATURA_SUGGESTION_ENGINE.versaoConfidence,
    versaoExplainability: ASSINATURA_SUGGESTION_ENGINE.versaoExplainability,
    correlacao: ctx.correlacao ?? null,
  };
}

/**
 * Gera (ou silencia). Fluxo: localizar memória → veredito PD-001 → registrar a
 * OFERTA (append-only) → só então devolver a Sugestao com o OfferId.
 *
 * Se o REGISTRO falhar, NÃO há sugestão (null): uma oferta não-auditável não
 * pode existir (ADR-001). A falha jamais propaga para o formulário.
 */
export async function gerarSugestao(
  ctx: ContextoDeDecisao & { entidade?: { tipo: string; id: string } | null; correlacao?: string | null },
  deps: DepsEngine = depsPadrao
): Promise<Sugestao | null> {
  try {
    const memoria = await localizarMemoria(ctx, deps.leitura);
    const veredito = veredictoElegibilidade(memoria);
    if (!veredito.elegivel || !memoria.maisFrequente) return null;
    const top = memoria.maisFrequente;

    // O fato ANTES da fala: sem registro gravado, a sugestão não existe.
    const oferta = montarOferta(ctx, top, crypto.randomUUID(), new Date().toISOString());
    await deps.ofertas.salvar(oferta);

    return {
      valor: top.valor,
      patternId: top.id,
      confidence: top.confidence,
      ocorrencias: top.ocorrencias,
      ultimaOcorrencia: top.ultimaOcorrencia,
      ultimoAutor: top.ultimoAutor,
      explicacao: top.explicacao,
      motivoElegibilidade: veredito.motivo,
      offerId: oferta.id,
    };
  } catch {
    // Nenhuma falha do Engine pode tocar o fluxo do operador.
    return null;
  }
}
