// Reprojection Runtime (E5.7) — o mecanismo OFICIAL de reconstrução.
//
// Aposenta o script manual (`scripts/validar-r-pd-1.ts`): a única projeção
// PERSISTIDA da AIL é `padroes` — todas as demais (Outcomes, Evolution,
// Readiness, Analytics) são recomputadas a cada leitura por construção e não
// precisam de reprojeção.
//
// O runtime executa `projetarPadroes()` (a função sancionada da R-PD-1,
// intocada) e devolve um RELATÓRIO DE AUDITORIA completo:
//   - COMPARAÇÃO antes × depois (novos / alterados / inalterados / órfãos);
//   - VERIFICAÇÃO DE IDEMPOTÊNCIA: o núcleo é computado DUAS vezes sobre os
//     mesmos fatos e os resultados comparados (confluência provada a cada
//     execução, não só em teste);
//   - ÓRFÃOS (linhas em `padroes` que a computação atual não produz — ex.:
//     canonicalização antiga) são LISTADOS, jamais apagados: remoção de
//     projeção é decisão de governança, não efeito colateral de reprojeção.
//
// REPROJEÇÃO PARCIAL por empresa é SEGURA por construção: a Pattern Key
// contém a empresa (RFC-AIL-003 §3.2) — slots jamais cruzam tenants, logo o
// subconjunto de decisões de uma empresa determina exatamente os seus
// Patterns. Total = todas as decisões; parcial = decisões da empresa.
//
// Determinismo herdado do núcleo (RFC-AIL-004 §7.3); o gatilho é sempre
// HUMANO (botão/chamada explícita) — nenhum cron, nenhum gatilho automático
// (R-PD-1: sob demanda, por design).

import { criarRepositorio } from "../../../lib/repositorio.ts";
import type { DecisaoRow } from "../../../lib/supabase/database.types.ts";
import type { Decision } from "../domain/decision.ts";
import type { Padrao } from "../domain/pattern.ts";
import { computarPadroes } from "../domain/pattern-detector.ts";
import { decisaoParaApp, decisaoParaBanco } from "../infrastructure/decision.mapper.ts";
import { projetarPadroes } from "../infrastructure/pattern-projection.ts";
import { reposLeituraPadrao, type ReposDeLeitura } from "./pattern-browser.ts";

const repoDecisoes = criarRepositorio<Decision, DecisaoRow>({
  tabela: "decisoes",
  colecao: "decisoes",
  prefixoIdLocal: "dec", // leitura apenas
  selecao: "*",
  paraApp: decisaoParaApp,
  paraBanco: decisaoParaBanco,
});

/** Dependências injetáveis (testes); produção usa os padrão. */
export interface ReposReprojecao {
  leitura: ReposDeLeitura; // snapshot ANTES (padroes)
  decisoes: {
    listar(filtro?: { coluna: string; valor: string; campoLocal: string }): Promise<Decision[]>;
  };
  padroes: { salvar(p: Padrao): Promise<Padrao> }; // escrita da projeção
}

/** Diferença de UM Pattern entre o estado anterior e o recomputado. */
export interface DiffPadrao {
  patternId: string;
  situacao: "novo" | "alterado" | "inalterado";
  antes: { ocorrencias: number; confidence: string; slotEstado: string } | null;
  depois: { ocorrencias: number; confidence: string; slotEstado: string };
}

/** O relatório de auditoria de uma reprojeção. */
export interface RelatorioReprojecao {
  escopo: { empresa: string | null; decisoesLidas: number };
  antes: number; // linhas materializadas no escopo antes
  depois: number; // patterns computados/gravados
  novos: number;
  alterados: number;
  inalterados: number;
  /** Linhas existentes que a computação atual NÃO produz — listadas, nunca apagadas. */
  orfaos: string[];
  diffs: DiffPadrao[];
  /** Confluência provada nesta execução: núcleo computado 2× → idêntico? */
  idempotencia: "verificada_identica" | "DIVERGENTE";
  explanation: string;
}

function resumo(p: Padrao) {
  return { ocorrencias: p.ocorrencias, confidence: p.confidence, slotEstado: p.slotEstado };
}

/** PURA: compara o estado anterior com o recomputado. */
export function compararProjecoes(
  antes: readonly Padrao[],
  depois: readonly Padrao[]
): { diffs: DiffPadrao[]; orfaos: string[] } {
  const porIdAntes = new Map(antes.map((p) => [p.id, p]));
  const idsDepois = new Set(depois.map((p) => p.id));
  const diffs: DiffPadrao[] = depois
    .map((p): DiffPadrao => {
      const anterior = porIdAntes.get(p.id);
      if (!anterior) return { patternId: p.id, situacao: "novo", antes: null, depois: resumo(p) };
      const mudou =
        anterior.ocorrencias !== p.ocorrencias ||
        anterior.confidence !== p.confidence ||
        anterior.slotEstado !== p.slotEstado ||
        anterior.ultimaOcorrencia !== p.ultimaOcorrencia;
      return {
        patternId: p.id,
        situacao: mudou ? "alterado" : "inalterado",
        antes: resumo(anterior),
        depois: resumo(p),
      };
    })
    .sort((a, b) => (a.patternId < b.patternId ? -1 : 1));
  const orfaos = antes
    .filter((p) => !idsDepois.has(p.id))
    .map((p) => p.id)
    .sort();
  return { diffs, orfaos };
}

/**
 * Reprojeta os Patterns (total, ou PARCIAL por empresa) e devolve o relatório
 * de auditoria. Gatilho sempre humano; idempotente por construção (upsert por
 * PatternId + núcleo confluente) — e a confluência é VERIFICADA na execução.
 */
export async function reprojetar(
  opcoes: { empresa?: string } = {},
  repos: ReposReprojecao = {
    leitura: reposLeituraPadrao,
    decisoes: repoDecisoes,
    padroes: reposLeituraPadrao.padroes as unknown as ReposReprojecao["padroes"],
  }
): Promise<RelatorioReprojecao> {
  const empresa = opcoes.empresa ?? null;

  // Snapshot ANTES (no escopo).
  const todosAntes = await repos.leitura.padroes.listar();
  const antes = empresa ? todosAntes.filter((p) => p.empresa === empresa) : todosAntes;

  // Decisões do escopo (parcial por empresa é seguro: slots não cruzam tenants).
  const filtro = empresa
    ? { coluna: "empresa", valor: empresa, campoLocal: "empresa" }
    : undefined;
  const decisoes = await repos.decisoes.listar(filtro);

  // Verificação de idempotência: o núcleo puro, DUAS vezes, sobre os mesmos fatos.
  const [computa1, computa2] = await Promise.all([
    computarPadroes(decisoes),
    computarPadroes(decisoes),
  ]);
  const idempotente = JSON.stringify(computa1) === JSON.stringify(computa2);

  // Materialização OFICIAL — exatamente a função sancionada da R-PD-1.
  const depois = await projetarPadroes({
    decisoes: { listar: async () => decisoes },
    padroes: repos.padroes,
  });

  const { diffs, orfaos } = compararProjecoes(antes, depois);
  const novos = diffs.filter((d) => d.situacao === "novo").length;
  const alterados = diffs.filter((d) => d.situacao === "alterado").length;
  const inalterados = diffs.filter((d) => d.situacao === "inalterado").length;

  return {
    escopo: { empresa, decisoesLidas: decisoes.length },
    antes: antes.length,
    depois: depois.length,
    novos,
    alterados,
    inalterados,
    orfaos,
    diffs,
    idempotencia: idempotente ? "verificada_identica" : "DIVERGENTE",
    explanation:
      `Reprojeção ${empresa ? `parcial (empresa ${empresa})` : "completa"}: ${decisoes.length} decisão(ões) lida(s) ` +
      `→ ${depois.length} Pattern(s) computado(s) e gravado(s) por upsert-por-PatternId (R-INF-001). ` +
      `Comparação: ${novos} novo(s), ${alterados} alterado(s), ${inalterados} inalterado(s)` +
      (orfaos.length > 0
        ? `; ${orfaos.length} órfão(s) listado(s) — linhas que a computação atual não produz; remoção é decisão de governança, nunca efeito colateral.`
        : "; nenhum órfão.") +
      ` Idempotência ${idempotente ? "verificada nesta execução (núcleo computado 2× → idêntico — confluência, RFC-AIL-004 §7.3)" : "DIVERGENTE — investigar imediatamente"}.`,
  };
}
