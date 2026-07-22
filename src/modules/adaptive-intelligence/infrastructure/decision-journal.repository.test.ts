// Testes da persistência do Decision Journal (R-DJ-3).
//
// Cobrem: round-trip bijetivo do mapper, preservação do DecisionId do domínio,
// idempotência (replay → 1 linha), fire-and-forget (falha síncrona e assíncrona
// nunca escapam) e compatibilidade com o Demo Store (shim de localStorage —
// padrão estabelecido em repositorio-salvar.test.ts).
//
// COMPATIBILIDADE SUPABASE — documentada, não duplicada: o ramo Supabase do
// adapter É o contrato salvar() da R-INF-001 (upsert onConflict:"id", idiom já
// validado em atualizarVarios e formalizado em repository-pattern-identity.md).
// Nenhuma infraestrutura exclusiva de teste é criada para ele.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/infrastructure/decision-journal.repository.test.ts

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Shim de localStorage: o store usa window.localStorage quando window existe.
class LocalStorageShim {
  private dados = new Map<string, string>();
  getItem(k: string): string | null {
    return this.dados.has(k) ? (this.dados.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.dados.set(k, v);
  }
  removeItem(k: string): void {
    this.dados.delete(k);
  }
  clear(): void {
    this.dados.clear();
  }
}
(globalThis as unknown as { window: { localStorage: LocalStorageShim } }).window = {
  localStorage: new LocalStorageShim(),
};

import { criarRepositorio } from "../../../lib/repositorio.ts";
import type { DecisaoRow } from "../../../lib/supabase/database.types.ts";
import type { Decision } from "../domain/decision.ts";
import { decisaoParaApp, decisaoParaBanco } from "./decision.mapper.ts";
import { RepositoryDecisionJournal } from "./decision-journal.repository.ts";

/** Espera o fire-and-forget assentar (a persistência demo resolve em microtask). */
const assentar = () => new Promise((r) => setImmediate(r));

function repoDecisoes() {
  return criarRepositorio<Decision, DecisaoRow>({
    tabela: "decisoes",
    colecao: "decisoes",
    prefixoIdLocal: "dec",
    selecao: "*",
    paraApp: decisaoParaApp,
    paraBanco: decisaoParaBanco,
  });
}

/** Decision MÁXIMA: entidade, correlação, metadados aninhados, nulls, especiais. */
const DECISAO_MAXIMA: Decision = {
  id: "3f2c8a10-9b1e-4d7c-a5f0-1234567890ab",
  empresa: "cli-03",
  autor: "ana@fitpro.com",
  contexto: "catalogo",
  entidade: { tipo: "pendencia", id: "pen-01" },
  campo: "informacaoPendente",
  valorAnterior: null,
  valorNovo: "Enviar acesso do TikTok Shop — planilha & \"custos\" (ção/ãé) 🚀",
  origem: "pendencias.resolverPendencia",
  timestamp: "2026-07-22T12:34:56.789Z",
  correlacao: "tar-03",
  metadados: { origemLote: true, aninhado: { nivel: 2, lista: [1, "dois", null] } },
};

/** Decision MÍNIMA: opcionais ausentes/nulos. */
const DECISAO_MINIMA: Decision = {
  id: "aa11bb22-cc33-4d44-8e55-ff6677889900",
  empresa: "cli-01",
  autor: "",
  contexto: "catalogo",
  entidade: { tipo: "pendencia", id: "pen-02" },
  campo: "informacaoPendente",
  valorAnterior: null,
  valorNovo: "Enviar planilha de custos atualizada",
  origem: "pendencias.resolverPendencia",
  timestamp: "2026-07-22T00:00:00.000Z",
  correlacao: null,
};

/** Simula a linha persistida: colunas do mapper + id injetado por salvar(). */
function linhaPersistida(d: Decision): DecisaoRow {
  return { ...decisaoParaBanco(d), id: d.id } as unknown as DecisaoRow;
}

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: LocalStorageShim } }).window.localStorage.clear();
});

test("round-trip completo: Decision → DecisaoRow → Decision sem perda (máxima)", () => {
  const reconstruida = decisaoParaApp(linhaPersistida(DECISAO_MAXIMA));
  assert.deepEqual(reconstruida, DECISAO_MAXIMA);
});

test("round-trip completo: Decision mínima (opcionais ausentes) sem perda", () => {
  const reconstruida = decisaoParaApp(linhaPersistida(DECISAO_MINIMA));
  assert.deepEqual(reconstruida, DECISAO_MINIMA);
});

test("DecisionId preservado: registrarDecisao → salvar() recebe o MESMO uuid", async () => {
  const recebidas: Decision[] = [];
  const journal = new RepositoryDecisionJournal({
    salvar: async (e) => {
      recebidas.push(e);
      return e;
    },
  });
  journal.registrarDecisao(DECISAO_MAXIMA);
  await assentar();
  assert.equal(recebidas.length, 1);
  assert.equal(recebidas[0].id, DECISAO_MAXIMA.id);
  assert.deepEqual(recebidas[0], DECISAO_MAXIMA); // adapter fino: nada alterado
});

test("ponta-a-ponta Demo Store: persiste e lê de volta com o id do domínio", async () => {
  const repo = repoDecisoes();
  const journal = new RepositoryDecisionJournal(repo);
  journal.registrarDecisao(DECISAO_MAXIMA);
  await assentar();
  const lida = await repo.buscar(DECISAO_MAXIMA.id);
  assert.ok(lida, "a decisão deve estar persistida no store");
  assert.equal(lida.id, DECISAO_MAXIMA.id);
});

test("idempotência: registrar a MESMA Decision duas vezes → 1 linha", async () => {
  const repo = repoDecisoes();
  const journal = new RepositoryDecisionJournal(repo);
  journal.registrarDecisao(DECISAO_MINIMA);
  journal.registrarDecisao(DECISAO_MINIMA); // replay
  await assentar();
  const todas = await repo.listar();
  assert.equal(todas.length, 1, "replay do mesmo DecisionId nunca duplica");
});

test("fire-and-forget: salvar() que REJEITA não escapa de registrarDecisao", async () => {
  const journal = new RepositoryDecisionJournal({
    salvar: async () => {
      throw new Error("falha simulada de persistência");
    },
  });
  assert.doesNotThrow(() => journal.registrarDecisao(DECISAO_MINIMA));
  await assentar(); // a rejeição assíncrona também é engolida (.catch)
});

test("fire-and-forget: salvar() que LANÇA SINCRONAMENTE também não escapa", () => {
  const journal = new RepositoryDecisionJournal({
    salvar: (() => {
      throw new Error("falha síncrona simulada");
    }) as unknown as (e: Decision) => Promise<Decision>,
  });
  assert.doesNotThrow(() => journal.registrarDecisao(DECISAO_MINIMA));
});
