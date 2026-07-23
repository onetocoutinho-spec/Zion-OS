// Knowledge Maturation — a execução da ADR-002 (E5.10a).
//
// NADA aqui reinterpreta a política: os critérios vivem no domínio
// (`knowledge.ts`, com as questões da ADR citadas); esta camada apenas
// orquestra: carrega as projeções existentes (E5.1/3/4 via Center), aplica o
// veredito PURO e registra o FATO append-only quando um humano assina.
//
//   Q3 (promoção híbrida): `verificarPromovibilidade` é a PROPOSTA do sistema;
//   `promoverConhecimento` só materializa com autor humano NÃO-VAZIO (a
//   assinatura é pré-condição — sem sessão, sem promoção) e motivo obrigatório.
//   Q5: `rebaixarConhecimento` idem — o sistema sinaliza, o humano rebaixa.

import { criarRepositorio } from "../../../lib/repositorio.ts";
import { autorAtual } from "../../../lib/auth/autorAtual.ts";
import type { ConhecimentoRow } from "../../../lib/supabase/database.types.ts";
import {
  estadoConhecimento,
  proximaVersao,
  sobContradicao,
  verificarPromovibilidade,
  VERSAO_POLITICA_MATURACAO,
  type CondicaoPromocao,
  type EstadoConhecimento,
  type FatoMaturacao,
} from "../domain/knowledge.ts";
import { conhecimentoParaApp, conhecimentoParaBanco } from "../infrastructure/knowledge.mapper.ts";
import { carregarPadraoNoCentro, type PadraoNoCentro } from "./intelligence-center.ts";

const repoConhecimentos = criarRepositorio<FatoMaturacao, ConhecimentoRow>({
  tabela: "conhecimentos",
  colecao: "conhecimentos",
  prefixoIdLocal: "knw", // nunca usado: id nasce no domínio (R-INF-001)
  selecao: "*",
  paraApp: conhecimentoParaApp,
  paraBanco: conhecimentoParaBanco,
});

/** Dependências injetáveis (testes). */
export interface DepsMaturacao {
  fatos: {
    listar(filtro?: { coluna: string; valor: string; campoLocal: string }): Promise<FatoMaturacao[]>;
    salvar(f: FatoMaturacao): Promise<FatoMaturacao>;
  };
  carregarPadrao: (patternId: string) => Promise<PadraoNoCentro | null>;
  autor: () => Promise<string>;
}

const depsPadrao: DepsMaturacao = {
  fatos: repoConhecimentos,
  carregarPadrao: carregarPadraoNoCentro,
  autor: autorAtual,
};

/** A visão completa do Knowledge de um Pattern — para o Center. */
export interface VisaoConhecimento {
  patternId: string;
  estado: EstadoConhecimento;
  promovibilidade: { promovivel: boolean; condicoes: CondicaoPromocao[] };
  /** Q5: vigente cujo Pattern deixou de sustentar os critérios (sinal). */
  sobContradicao: boolean;
}

async function fatosDoPattern(patternId: string, deps: DepsMaturacao): Promise<FatoMaturacao[]> {
  return deps.fatos.listar({ coluna: "pattern_id", valor: patternId, campoLocal: "patternId" });
}

/** Carrega o estado + a proposta do sistema (Q3) para um Pattern. */
export async function carregarConhecimento(
  patternId: string,
  deps: DepsMaturacao = depsPadrao
): Promise<VisaoConhecimento | null> {
  const linha = await deps.carregarPadrao(patternId);
  const fatos = await fatosDoPattern(patternId, deps);
  const estado = estadoConhecimento(fatos);
  if (!linha) {
    // Pattern de origem ausente (ex.: reprojeção): o Knowledge sobrevive
    // (fotografia autossuficiente) e o sinal de contradição acende (ADR §Riscos).
    return estado.situacao === "nenhum"
      ? null
      : {
          patternId,
          estado,
          promovibilidade: { promovivel: false, condicoes: [] },
          sobContradicao: sobContradicao(estado, null),
        };
  }
  return {
    patternId,
    estado,
    promovibilidade: verificarPromovibilidade(linha.readiness, linha.outcomes, fatos),
    sobContradicao: sobContradicao(estado, linha.readiness),
  };
}

export type ResultadoMaturacao =
  | { ok: true; fato: FatoMaturacao }
  | { ok: false; motivos: string[] };

/**
 * PROMOVE (Q3): ato humano assinado sobre a proposta do sistema. Falha com
 * motivos citáveis quando qualquer condição da ADR-002 não vale.
 */
export async function promoverConhecimento(
  patternId: string,
  motivo: string,
  deps: DepsMaturacao = depsPadrao
): Promise<ResultadoMaturacao> {
  if (!motivo.trim()) return { ok: false, motivos: ["motivo é obrigatório (ADR-002 §Riscos)"] };
  const autor = (await deps.autor()).trim();
  if (!autor)
    return { ok: false, motivos: ["promoção exige assinatura humana — sem sessão autenticada não há promoção (ADR-002 Q3)"] };

  const linha = await deps.carregarPadrao(patternId);
  if (!linha) return { ok: false, motivos: ["Pattern de origem não encontrado"] };
  const fatos = await fatosDoPattern(patternId, deps);
  const veredito = verificarPromovibilidade(linha.readiness, linha.outcomes, fatos);
  if (!veredito.promovivel) {
    return {
      ok: false,
      motivos: veredito.condicoes.filter((c) => !c.ok).map((c) => `${c.condicao}: ${c.evidencia}`),
    };
  }

  const respondidosConsiderados = veredito.condicoes[1].evidencia;
  const fato: FatoMaturacao = {
    id: crypto.randomUUID(),
    patternId,
    empresa: linha.padrao.empresa,
    contexto: linha.padrao.contexto,
    campo: linha.padrao.campo,
    valor: linha.padrao.valor,
    tipo: "promocao",
    versao: proximaVersao(fatos),
    autorHumano: autor,
    motivo: motivo.trim(),
    fotografia: {
      confidenceNoInstante: linha.padrao.confidence,
      suporteIndependente: linha.evolution.suporte.independente,
      decisoesIndependentes: linha.evolution.evidenciasUtilizadas.decisoesIndependentes,
      outcomesConsiderados: linha.outcomes
        .filter((o) => o.status !== "pending")
        .map((o) => o.outcomeId)
        .sort(),
      ultimoOutcomeStatus: respondidosConsiderados.includes("confirmed") ? "confirmed" : null,
      readinessBloqueios: linha.readiness.bloqueios,
    },
    versaoPolitica: VERSAO_POLITICA_MATURACAO,
    ocorridoEm: new Date().toISOString(),
  };
  await deps.fatos.salvar(fato);
  return { ok: true, fato };
}

/**
 * REBAIXA (Q5): ato humano assinado sobre um Knowledge vigente. O sistema
 * nunca chega aqui sozinho — apenas sinaliza (`sobContradicao`).
 */
export async function rebaixarConhecimento(
  patternId: string,
  motivo: string,
  deps: DepsMaturacao = depsPadrao
): Promise<ResultadoMaturacao> {
  if (!motivo.trim()) return { ok: false, motivos: ["motivo é obrigatório (ADR-002 Q5)"] };
  const autor = (await deps.autor()).trim();
  if (!autor)
    return { ok: false, motivos: ["rebaixamento exige assinatura humana (ADR-002 Q5)"] };

  const fatos = await fatosDoPattern(patternId, deps);
  const estado = estadoConhecimento(fatos);
  if (estado.situacao !== "vigente" || !estado.promocaoVigente) {
    return { ok: false, motivos: ["não há Knowledge vigente para rebaixar"] };
  }
  const vigente = estado.promocaoVigente;
  const fato: FatoMaturacao = {
    id: crypto.randomUUID(),
    patternId,
    empresa: vigente.empresa,
    contexto: vigente.contexto,
    campo: vigente.campo,
    valor: vigente.valor,
    tipo: "rebaixamento",
    versao: vigente.versao,
    autorHumano: autor,
    motivo: motivo.trim(),
    fotografia: vigente.fotografia, // a fotografia que sustentava a versão rebaixada
    versaoPolitica: VERSAO_POLITICA_MATURACAO,
    ocorridoEm: new Date().toISOString(),
  };
  await deps.fatos.salvar(fato);
  return { ok: true, fato };
}
