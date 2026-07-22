// RepositoryDecisionJournal — implementação PERSISTENTE do Port DecisionJournal
// (R-DJ-3). Substitui o NoOp como implementação ativa via Factory.
//
// Adapter DELIBERADAMENTE FINO. Fluxo único:
//
//   Decision → decisaoParaBanco() (via criarRepositorio) → Repository.salvar() → fim
//
// O adapter NÃO gera IDs, NÃO altera Decisions, NÃO cria metadados, NÃO aplica
// regras, NÃO interpreta o domínio, NÃO modifica timestamps nem valores. Sua
// única responsabilidade é adaptar o Port à infraestrutura de persistência.
//
// Identidade: `salvar()` (R-INF-001) preserva o DecisionId gerado pelo domínio
// nos dois modos (Supabase upsert onConflict:"id" / demo upsertItem) e torna o
// replay idempotente (mesmo id → uma linha) — RFC-AIL-004 §7.
//
// Fire-and-forget (RFC-AIL-001 §6.2): registrarDecisao retorna void, NÃO aguarda
// a persistência e NUNCA propaga exceção — nem assíncrona (.catch) nem síncrona
// (try/catch). Falha de persistência jamais afeta o fluxo do Producer.

import { criarRepositorio } from "../../../lib/repositorio.ts";
import type { DecisaoRow } from "../../../lib/supabase/database.types.ts";
import type { Decision } from "../domain/decision.ts";
import type { DecisionJournal } from "../ports/decision-journal.port.ts";
import { decisaoParaApp, decisaoParaBanco } from "./decision.mapper.ts";

const repoPadrao = criarRepositorio<Decision, DecisaoRow>({
  tabela: "decisoes",
  colecao: "decisoes",
  prefixoIdLocal: "dec", // exigido pela config; salvar() nunca gera id
  selecao: "*",
  paraApp: decisaoParaApp,
  paraBanco: decisaoParaBanco,
});

export class RepositoryDecisionJournal implements DecisionJournal {
  // Injeção usada apenas por testes; produção usa o repositório padrão.
  constructor(
    private readonly repo: { salvar(entidade: Decision): Promise<Decision> } = repoPadrao
  ) {}

  registrarDecisao(decisao: Decision): void {
    try {
      void this.repo.salvar(decisao).catch(() => {
        // fire-and-forget: falha assíncrona de persistência é descartada.
      });
    } catch {
      // fire-and-forget: nem falha síncrona escapa (Port: nunca lança).
    }
  }
}
