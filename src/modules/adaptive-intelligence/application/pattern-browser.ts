// Pattern Browser — a camada de LEITURA da Adaptive Intelligence Layer (E4.0).
//
// Primeiro consumidor do Runtime da AIL, exatamente como a RFC-AIL-004 §9
// previu ("Métricas" e "Explainability" são LEITORES da projeção). Contratos:
//
//   - SOMENTE LEITURA: nenhuma escrita, nenhuma recomputação de confidence,
//     nenhum estado novo. Tudo aqui é visão derivada das DUAS projeções que já
//     existem (tabelas `padroes` e `decisoes`) — The Pattern Browser Never
//     Learns, Never Decides, Only Reveals.
//   - RASTREABILIDADE TOTAL: cada campo do ViewModel declara a origem; a
//     explicação da Confidence é derivada dos limiares CONGELADOS (RFC-AIL-004
//     §4.3/§4.4), nunca gerada.
//   - Divergência NÃO é cálculo novo: é o agrupamento dos Patterns já
//     materializados pelo slot (empresa, contexto, campo) — o mesmo slot da
//     RFC-AIL-003 §3.3, com o estado `em_disputa` que o Detector já gravou.
//
// Domínio e Detector permanecem intocados (Architecture Freeze v1).

import { criarRepositorio } from "../../../lib/repositorio.ts";
import { autorDe, rotuloDe } from "../domain/author.ts";
import type { DecisaoRow, PadraoRow } from "../../../lib/supabase/database.types.ts";
import type { Decision } from "../domain/decision.ts";
import type { Padrao } from "../domain/pattern.ts";
import {
  LIMIAR_CONSISTENTE,
  LIMIAR_RECORRENTE,
} from "../domain/pattern.ts";
import { decisaoParaApp, decisaoParaBanco } from "../infrastructure/decision.mapper.ts";
import { padraoParaApp, padraoParaBanco } from "../infrastructure/pattern.mapper.ts";

// ── Repositórios de leitura (mesmos mappers da projeção; jamais escrevem) ────

const repoPadroes = criarRepositorio<Padrao, PadraoRow>({
  tabela: "padroes",
  colecao: "padroes",
  prefixoIdLocal: "pad", // nunca usado: leitura apenas
  selecao: "*",
  paraApp: padraoParaApp,
  paraBanco: padraoParaBanco,
});

const repoDecisoes = criarRepositorio<Decision, DecisaoRow>({
  tabela: "decisoes",
  colecao: "decisoes",
  prefixoIdLocal: "dec", // nunca usado: leitura apenas
  selecao: "*",
  paraApp: decisaoParaApp,
  paraBanco: decisaoParaBanco,
});

/** Repositórios injetáveis (testes); produção usa os padrão. */
export interface ReposDeLeitura {
  padroes: { listar(): Promise<Padrao[]> };
  decisoes: {
    listar(filtro?: { coluna: string; valor: string; campoLocal: string }): Promise<Decision[]>;
  };
}

/** Os repositórios de leitura padrão da AIL (compartilhados pelos consumidores). */
export const reposLeituraPadrao: ReposDeLeitura = { padroes: repoPadroes, decisoes: repoDecisoes };
const reposPadrao = reposLeituraPadrao;

// ── ViewModels — cada campo com origem declarada ─────────────────────────────

/** Uma evidência: a Decision como o operador precisa vê-la. Origem: `decisoes`. */
export interface VisaoDecisao {
  id: string; // decisoes.id
  autor: string; // decisoes.autor rotulado ("" → "não registrado")
  quando: string; // decisoes.decidido_em (Decision.timestamp)
  valorAnterior: string | null; // o que o sistema/ambiente propôs
  valorNovo: string; // a escolha humana
  origem: string; // tela/ação (rastreabilidade — RFC-AIL-001 §5)
  entidade: { tipo: string; id: string };
}

/** Um Pattern na listagem. Origem: linha de `padroes` (zero recomputação). */
export interface VisaoPadrao {
  id: string; // PatternId (SHA-256 da chave)
  empresa: string;
  contexto: string;
  campo: string;
  valor: string; // o valorNovo canônico — O QUE a organização sabe
  confidence: Padrao["confidence"];
  estado: Padrao["estado"];
  slotEstado: Padrao["slotEstado"];
  ocorrencias: number; // |DecisionIds distintos|
  primeiraOcorrencia: string;
  ultimaOcorrencia: string;
  decisoesDeSuporte: readonly string[]; // os DecisionIds — a corrente de evidência
}

/** O detalhe completo: Pattern + evidências + contexto do slot. */
export interface DetalhePadrao extends VisaoPadrao {
  /** Derivado dos limiares congelados — por que ESTA confidence (§4.3/§4.4). */
  explicacaoConfidence: string;
  /** Evidências (Decisions de suporte), mais recente primeiro. */
  evidencias: VisaoDecisao[];
  /** Derivado: autor da evidência mais recente. */
  ultimoAutor: string;
  /** Derivado: autores distintos rotulados. */
  autores: string[];
  /** Os OUTROS Patterns do mesmo slot (divergências) — navegação relacionada. */
  concorrentes: VisaoPadrao[];
}

/** Um slot com seus Patterns — a unidade de navegação da listagem. */
export interface VisaoSlot {
  empresa: string;
  contexto: string;
  campo: string;
  emDisputa: boolean; // slotEstado já materializado (nenhum cálculo novo)
  padroes: VisaoPadrao[]; // por ocorrências (desc) — nunca é ranking p/ agir
}

// ── Funções PURAS ────────────────────────────────────────────────────────────

/**
 * Autor legível — desde a E5.8, via o Value Object tipado (`autorDe`): mesma
 * saída de sempre para os fatos existentes (e-mails e ""), e rótulo de sistema
 * para autoria de componente. As Decisions pré-E4.2.3 são anônimas de fato.
 */
export function rotuloAutor(autor: string): string {
  return rotuloDe(autorDe(autor));
}

/**
 * POR QUE esta Confidence — derivada exclusivamente dos limiares congelados
 * (RFC-AIL-004 §4.3/§4.4). Nunca gerada, nunca opinativa.
 */
export function explicarConfidence(p: Padrao): string {
  if (p.confidence === "consistente") {
    return `${p.ocorrencias} decisões distintas (≥ ${LIMIAR_CONSISTENTE}) e é o único valor recorrente do slot — repetição estável sem contradição.`;
  }
  if (p.confidence === "recorrente") {
    if (p.slotEstado === "em_disputa") {
      return `${p.ocorrencias} decisões distintas, mas outro valor também recorre neste slot — a disputa bloqueia a graduação (nada foi apagado; o suporte permanece).`;
    }
    return `${p.ocorrencias} decisões distintas (≥ ${LIMIAR_RECORRENTE}) — recorre, mas ainda não atingiu ${LIMIAR_CONSISTENTE} com slot sem disputa.`;
  }
  return `1 decisão registrada — observação isolada; recorrência começa na ${LIMIAR_RECORRENTE}ª decisão distinta.`;
}

/** Projeção de leitura de um Padrão materializado (campo a campo, sem derivar). */
export function visaoDe(p: Padrao): VisaoPadrao {
  return {
    id: p.id,
    empresa: p.empresa,
    contexto: p.contexto,
    campo: p.campo,
    valor: p.valorNovo,
    confidence: p.confidence,
    estado: p.estado,
    slotEstado: p.slotEstado,
    ocorrencias: p.ocorrencias,
    primeiraOcorrencia: p.primeiraOcorrencia,
    ultimaOcorrencia: p.ultimaOcorrencia,
    decisoesDeSuporte: p.decisoesDeSuporte,
  };
}

export function visaoDecisaoDe(d: Decision): VisaoDecisao {
  return {
    id: d.id,
    autor: rotuloAutor(d.autor),
    quando: d.timestamp,
    valorAnterior: d.valorAnterior,
    valorNovo: d.valorNovo,
    origem: d.origem,
    entidade: d.entidade,
  };
}

/** Agrupa os Patterns materializados por slot (RFC-AIL-003 §3.3). */
export function agruparPorSlot(padroes: readonly Padrao[]): VisaoSlot[] {
  const slots = new Map<string, VisaoSlot>();
  for (const p of padroes) {
    const chave = JSON.stringify([p.empresa, p.contexto, p.campo]);
    let slot = slots.get(chave);
    if (!slot) {
      slot = {
        empresa: p.empresa,
        contexto: p.contexto,
        campo: p.campo,
        emDisputa: false,
        padroes: [],
      };
      slots.set(chave, slot);
    }
    slot.padroes.push(visaoDe(p));
    if (p.slotEstado === "em_disputa") slot.emDisputa = true;
  }
  for (const slot of slots.values()) {
    slot.padroes.sort((a, b) => b.ocorrencias - a.ocorrencias || (a.valor < b.valor ? -1 : 1));
  }
  // Ordem estável de navegação: contexto, campo, empresa.
  return [...slots.values()].sort((a, b) =>
    `${a.contexto}|${a.campo}|${a.empresa}` < `${b.contexto}|${b.campo}|${b.empresa}` ? -1 : 1
  );
}

/**
 * Monta o detalhe explicável de um Pattern: evidências (só as Decisions de
 * suporte — a corrente registrada pelo Detector), autores e concorrentes.
 */
export function montarDetalhe(
  padrao: Padrao,
  decisoesDaEmpresa: readonly Decision[],
  todosPadroes: readonly Padrao[]
): DetalhePadrao {
  const suporte = new Set(padrao.decisoesDeSuporte);
  const evidencias = decisoesDaEmpresa
    .filter((d) => suporte.has(d.id))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .map(visaoDecisaoDe);
  const autores = [...new Set(evidencias.map((e) => e.autor))];
  const concorrentes = todosPadroes
    .filter(
      (p) =>
        p.id !== padrao.id &&
        p.empresa === padrao.empresa &&
        p.contexto === padrao.contexto &&
        p.campo === padrao.campo
    )
    .map(visaoDe)
    .sort((a, b) => b.ocorrencias - a.ocorrencias);
  return {
    ...visaoDe(padrao),
    explicacaoConfidence: explicarConfidence(padrao),
    evidencias,
    ultimoAutor: evidencias[0]?.autor ?? "não registrado",
    autores,
    concorrentes,
  };
}

// ── Consultas (leitura pura sobre as projeções existentes) ───────────────────

/** Tudo que a Zion sabe hoje, agrupado por slot. */
export async function carregarSlots(repos: ReposDeLeitura = reposPadrao): Promise<VisaoSlot[]> {
  const padroes = await repos.padroes.listar();
  return agruparPorSlot(padroes);
}

/**
 * O detalhe explicável de um Pattern (null se não existir). As evidências vêm
 * do Journal filtrado pela EMPRESA do Pattern (isolamento por tenant) e
 * restritas aos DecisionIds de suporte — nada é inferido.
 */
export async function carregarDetalhePadrao(
  id: string,
  repos: ReposDeLeitura = reposPadrao
): Promise<DetalhePadrao | null> {
  const padroes = await repos.padroes.listar();
  const padrao = padroes.find((p) => p.id === id);
  if (!padrao) return null;
  const decisoes = await repos.decisoes.listar({
    coluna: "empresa",
    valor: padrao.empresa,
    campoLocal: "empresa",
  });
  return montarDetalhe(padrao, decisoes, padroes);
}
