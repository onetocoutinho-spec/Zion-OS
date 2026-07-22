// Pattern Projection — materialização sob demanda dos Patterns (R-PD-1, Etapa 3).
//
// Fluxo único, sem regra de negócio nova (toda a inteligência vive no domínio):
//
//   Decision Journal (tabela decisoes) → Repository.listar()
//     → computarPadroes() (núcleo puro, RFC-AIL-004)
//     → PatternMapper → Repository.salvar() → tabela padroes
//
// A projeção é COMPLETAMENTE RECONSTRUÍVEL: nenhum estado interno, nenhum
// cursor, nenhuma marcação de "já processado". É função determinística do
// Decision Journal (confluência — RFC-AIL-004 §7.3); executá-la N vezes produz
// exatamente o mesmo estado, porque:
//   - o núcleo é puro e idempotente (dedup por DecisionId);
//   - o PatternId é derivado da chave (mesma chave → mesmo id);
//   - salvar() é upsert por id (R-INF-001) → re-projeção regrava as MESMAS linhas.
//
// Toda persistência passa pelo Repository Pattern — nenhum acesso direto a
// localStorage/Supabase/SQL/Store. Execução SOB DEMANDA (R-PD-1: sem gatilho
// automático, sem UI, sem ação — ARQ-003 §13 R-AIL-2).

import { criarRepositorio } from "../../../lib/repositorio.ts";
import type { DecisaoRow, PadraoRow } from "../../../lib/supabase/database.types.ts";
import type { Decision } from "../domain/decision.ts";
import type { Padrao } from "../domain/pattern.ts";
import { computarPadroes } from "../domain/pattern-detector.ts";
import { decisaoParaApp, decisaoParaBanco } from "./decision.mapper.ts";
import { padraoParaApp, padraoParaBanco } from "./pattern.mapper.ts";

const repoDecisoesPadrao = criarRepositorio<Decision, DecisaoRow>({
  tabela: "decisoes",
  colecao: "decisoes",
  prefixoIdLocal: "dec", // nunca usado: leitura apenas
  selecao: "*",
  paraApp: decisaoParaApp,
  paraBanco: decisaoParaBanco,
});

const repoPadroesPadrao = criarRepositorio<Padrao, PadraoRow>({
  tabela: "padroes",
  colecao: "padroes",
  prefixoIdLocal: "pad", // nunca usado: salvar() preserva o PatternId do domínio
  selecao: "*",
  paraApp: padraoParaApp,
  paraBanco: padraoParaBanco,
});

/**
 * Projeta o Decision Journal em Patterns materializados e devolve o conjunto
 * computado. Injeção de repositórios apenas para testes; produção usa os padrão.
 */
export async function projetarPadroes(
  repos: {
    decisoes: { listar(): Promise<Decision[]> };
    padroes: { salvar(padrao: Padrao): Promise<Padrao> };
  } = { decisoes: repoDecisoesPadrao, padroes: repoPadroesPadrao }
): Promise<Padrao[]> {
  const decisoes = await repos.decisoes.listar();
  const padroes = await computarPadroes(decisoes);
  for (const padrao of padroes) {
    await repos.padroes.salvar(padrao);
  }
  return padroes;
}
