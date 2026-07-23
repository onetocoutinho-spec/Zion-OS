// Delegation Runtime (E5.10b) — o último elo do roadmap.
//
// Delegar = um humano (autoridade) concede ao sistema (executor ASSINADO —
// E5.9) o direito de executar um Knowledge institucional VIGENTE num slot.
// Jamais Confidence: Confidence mede aprendizagem; Knowledge representa
// decisão institucional (ADR-002 Q8).
//
// EXECUÇÃO AUDITADA NO LEDGER EXISTENTE: cada execução delegada registra uma
// OFERTA assinada por `sistema:delegation-runtime` (correlacao
// `delegacao:<id>`) ANTES de devolver o valor — "o fato antes da fala"
// (ADR-001). Com isso, toda a maquinaria E5.0→E5.3 audita as execuções
// delegadas automaticamente: Outcomes observam as respostas, a Confidence
// Evolution desconta o eco. Nenhum mecanismo novo de auditoria foi criado —
// o existente cobre o novo ator.
//
// A execução continua preenchendo apenas o VAZIO (Lei da Abstenção) e o
// valor continua editável: delegar não remove o humano do circuito — remove
// apenas a necessidade de ele iniciar.

import { criarRepositorio } from "../../../lib/repositorio.ts";
import { autorAtual } from "../../../lib/auth/autorAtual.ts";
import type { DelegacaoRow, OfertaRow } from "../../../lib/supabase/database.types.ts";
import {
  estadoDelegacao,
  execucaoPermitida,
  verificarDelegabilidade,
  type EstadoDelegacao,
  type FatoDelegacao,
} from "../domain/delegation.ts";
import { estadoConhecimento } from "../domain/knowledge.ts";
import { assinaturaDe, type AssinaturaDeSistema } from "../domain/system-authorship.ts";
import type { Oferta } from "../domain/offer.ts";
import { delegacaoParaApp, delegacaoParaBanco } from "../infrastructure/delegation.mapper.ts";
import { ofertaParaApp, ofertaParaBanco } from "../infrastructure/offer.mapper.ts";
import {
  carregarConhecimento,
  type DepsMaturacao,
  type VisaoConhecimento,
} from "./knowledge-maturation.ts";
import type { ContextoDeDecisao } from "./pattern-matching.ts";

/** A assinatura vigente do executor delegado (E5.9 — obrigatória por regra). */
export const ASSINATURA_DELEGATION_RUNTIME: AssinaturaDeSistema = assinaturaDe(
  "delegation-runtime",
  "E5.10b v1"
);

const repoDelegacoes = criarRepositorio<FatoDelegacao, DelegacaoRow>({
  tabela: "delegacoes",
  colecao: "delegacoes",
  prefixoIdLocal: "dlg", // nunca usado: id do domínio (R-INF-001)
  selecao: "*",
  paraApp: delegacaoParaApp,
  paraBanco: delegacaoParaBanco,
});

const repoOfertasExecucao = criarRepositorio<Oferta, OfertaRow>({
  tabela: "ofertas",
  colecao: "ofertas",
  prefixoIdLocal: "ofr",
  selecao: "*",
  paraApp: ofertaParaApp,
  paraBanco: ofertaParaBanco,
});

export interface DepsDelegacao {
  fatos: {
    listar(filtro?: { coluna: string; valor: string; campoLocal: string }): Promise<FatoDelegacao[]>;
    salvar(f: FatoDelegacao): Promise<FatoDelegacao>;
  };
  ofertas: { salvar(o: Oferta): Promise<Oferta> };
  conhecimento: (patternId: string) => Promise<VisaoConhecimento | null>;
  autor: () => Promise<string>;
}

const depsPadrao: DepsDelegacao = {
  fatos: repoDelegacoes,
  ofertas: repoOfertasExecucao,
  conhecimento: (patternId) => carregarConhecimento(patternId),
  autor: autorAtual,
};

async function fatosDoSlot(
  empresa: string,
  contexto: string,
  campo: string,
  deps: DepsDelegacao
): Promise<FatoDelegacao[]> {
  const todos = await deps.fatos.listar({ coluna: "empresa", valor: empresa, campoLocal: "empresa" });
  return todos.filter((f) => f.contexto === contexto && f.campo === campo);
}

/** O estado da delegação de um slot (para o Center). */
export async function carregarDelegacao(
  empresa: string,
  contexto: string,
  campo: string,
  deps: DepsDelegacao = depsPadrao
): Promise<EstadoDelegacao> {
  return estadoDelegacao(await fatosDoSlot(empresa, contexto, campo, deps));
}

export type ResultadoDelegacao =
  | { ok: true; fato: FatoDelegacao }
  | { ok: false; motivos: string[] };

/** CONCEDE a delegação: ato humano assinado sobre Knowledge vigente. */
export async function concederDelegacao(
  patternId: string,
  motivo: string,
  deps: DepsDelegacao = depsPadrao,
  maturacao?: DepsMaturacao
): Promise<ResultadoDelegacao> {
  if (!motivo.trim()) return { ok: false, motivos: ["motivo é obrigatório"] };
  const autoridade = (await deps.autor()).trim();
  const conhecimento = maturacao
    ? await carregarConhecimento(patternId, maturacao)
    : await deps.conhecimento(patternId);
  const veredito = verificarDelegabilidade(conhecimento, autoridade);
  if (!veredito.delegavel) {
    return {
      ok: false,
      motivos: veredito.condicoes.filter((c) => !c.ok).map((c) => `${c.condicao}: ${c.evidencia}`),
    };
  }
  const vigente = conhecimento!.estado.promocaoVigente!;
  const fato: FatoDelegacao = {
    id: crypto.randomUUID(),
    empresa: vigente.empresa,
    contexto: vigente.contexto,
    campo: vigente.campo,
    knowledgePatternId: patternId,
    knowledgeVersao: vigente.versao,
    valorDelegado: vigente.valor,
    tipo: "concessao",
    delegadoPor: autoridade,
    motivo: motivo.trim(),
    assinatura: ASSINATURA_DELEGATION_RUNTIME,
    evidencias: vigente.fotografia,
    ocorridoEm: new Date().toISOString(),
  };
  await deps.fatos.salvar(fato);
  return { ok: true, fato };
}

/** REVOGA: fecha a torneira futura; o passado permanece (PR-011). */
export async function revogarDelegacao(
  patternId: string,
  motivo: string,
  deps: DepsDelegacao = depsPadrao
): Promise<ResultadoDelegacao> {
  if (!motivo.trim()) return { ok: false, motivos: ["motivo é obrigatório"] };
  const autoridade = (await deps.autor()).trim();
  if (!autoridade) return { ok: false, motivos: ["revogação exige assinatura humana"] };
  const conhecimento = await deps.conhecimento(patternId);
  const vigenteConhecimento = conhecimento?.estado.promocaoVigente ?? conhecimento?.estado.historico[0];
  if (!vigenteConhecimento) return { ok: false, motivos: ["Knowledge não encontrado para o Pattern"] };
  const delegacao = await carregarDelegacao(
    vigenteConhecimento.empresa,
    vigenteConhecimento.contexto,
    vigenteConhecimento.campo,
    deps
  );
  if (delegacao.situacao !== "vigente" || !delegacao.concessaoVigente) {
    return { ok: false, motivos: ["não há delegação vigente para revogar"] };
  }
  const c = delegacao.concessaoVigente;
  const fato: FatoDelegacao = {
    ...c,
    id: crypto.randomUUID(),
    tipo: "revogacao",
    delegadoPor: autoridade,
    motivo: motivo.trim(),
    ocorridoEm: new Date().toISOString(),
  };
  await deps.fatos.salvar(fato);
  return { ok: true, fato };
}

/** Uma execução delegada — com a explicabilidade COMPLETA exigida. */
export interface ExecucaoDelegada {
  valor: string;
  delegacaoId: string;
  knowledgePatternId: string;
  knowledgeVersao: number;
  delegadoPor: string; // quem delegou (a autoridade)
  assinatura: AssinaturaDeSistema; // qual assinatura do sistema
  evidencias: FatoDelegacao["evidencias"]; // quais evidências sustentaram
  offerId: string; // o fato de execução registrado (ledger de ofertas)
  explanation: string;
}

/**
 * EXECUTA (nível 5 sob grant): se há delegação vigente para o slot e o
 * Knowledge que a fundamenta CONTINUA vigente na mesma versão, registra o
 * fato de execução (oferta assinada pelo runtime) e devolve o valor com a
 * explicabilidade completa. Caso contrário: null — silêncio, nunca erro.
 */
export async function executarDelegacao(
  ctx: ContextoDeDecisao & { entidade?: { tipo: string; id: string } | null },
  deps: DepsDelegacao = depsPadrao
): Promise<ExecucaoDelegada | null> {
  try {
    const delegacao = await carregarDelegacao(ctx.empresa, ctx.contexto, ctx.campo, deps);
    if (delegacao.situacao !== "vigente" || !delegacao.concessaoVigente) return null;
    const c = delegacao.concessaoVigente;
    const conhecimento = await deps.conhecimento(c.knowledgePatternId);
    const veredito = execucaoPermitida(delegacao, conhecimento?.estado ?? null);
    if (!veredito.permitida) return null; // rebaixamento revogou a execução futura

    // O fato ANTES da fala (ADR-001): a execução registra uma oferta assinada
    // pelo runtime — e herda TODA a auditoria E5.0→E5.3 automaticamente.
    const oferta: Oferta = {
      id: crypto.randomUUID(),
      oferecidaEm: new Date().toISOString(),
      empresa: c.empresa,
      contexto: c.contexto,
      campo: c.campo,
      entidade: ctx.entidade ?? null,
      patternId: c.knowledgePatternId,
      valorOferecido: c.valorDelegado,
      confidenceUtilizada: `knowledge v${c.knowledgeVersao} (institucional — ADR-002)`,
      ocorrenciasNoMomento: c.evidencias.suporteIndependente,
      autorDaOferta: ASSINATURA_DELEGATION_RUNTIME.autor,
      versaoContrato: ASSINATURA_DELEGATION_RUNTIME.versaoContrato,
      origemExplicacao: "delegacao sobre Knowledge vigente (ADR-002 Q8)",
      versaoEngine: ASSINATURA_DELEGATION_RUNTIME.versaoEngine,
      versaoConfidence: ASSINATURA_DELEGATION_RUNTIME.versaoConfidence,
      versaoExplainability: ASSINATURA_DELEGATION_RUNTIME.versaoExplainability,
      correlacao: `delegacao:${c.id}`,
    };
    await deps.ofertas.salvar(oferta);

    return {
      valor: c.valorDelegado,
      delegacaoId: c.id,
      knowledgePatternId: c.knowledgePatternId,
      knowledgeVersao: c.knowledgeVersao,
      delegadoPor: c.delegadoPor,
      assinatura: c.assinatura,
      evidencias: c.evidencias,
      offerId: oferta.id,
      explanation:
        `Preenchido por delegação: ${c.delegadoPor} delegou o slot ${c.contexto}·${c.campo} ` +
        `ao ${c.assinatura.autor} (${c.assinatura.versaoEngine}) sobre o Knowledge v${c.knowledgeVersao} ` +
        `(Pattern ${c.knowledgePatternId}). Execução registrada como oferta ${oferta.id} — ` +
        `editável, removível; revogar a delegação ou rebaixar o Knowledge encerra as próximas.`,
    };
  } catch {
    return null; // nenhuma falha do runtime pode tocar o fluxo do operador
  }
}
