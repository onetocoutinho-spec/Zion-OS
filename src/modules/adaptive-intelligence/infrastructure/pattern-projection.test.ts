// Testes da materialização dos Patterns (Etapa 3 da R-PD-1).
//
// Cobrem: round-trip bijetivo do mapper, materialização correta, replay
// idempotente (N execuções → mesmo estado), preservação de PatternId/
// PatternKey/ocorrências/confidence e reconstrução integral da projeção a
// partir do Decision Journal. Toda persistência via Repository (shim de
// localStorage — padrão estabelecido); nenhum acesso direto a store/SQL.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/infrastructure/pattern-projection.test.ts

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

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
import type { DecisaoRow, PadraoRow } from "../../../lib/supabase/database.types.ts";
import type { Decision } from "../domain/decision.ts";
import type { Padrao } from "../domain/pattern.ts";
import { chaveDe, patternIdDe } from "../domain/pattern-key.ts";
import { decisaoParaApp, decisaoParaBanco } from "./decision.mapper.ts";
import { padraoParaApp, padraoParaBanco } from "./pattern.mapper.ts";
import { projetarPadroes } from "./pattern-projection.ts";

const repoDecisoes = () =>
  criarRepositorio<Decision, DecisaoRow>({
    tabela: "decisoes",
    colecao: "decisoes",
    prefixoIdLocal: "dec",
    selecao: "*",
    paraApp: decisaoParaApp,
    paraBanco: decisaoParaBanco,
  });

const repoPadroes = () =>
  criarRepositorio<Padrao, PadraoRow>({
    tabela: "padroes",
    colecao: "padroes",
    prefixoIdLocal: "pad",
    selecao: "*",
    paraApp: padraoParaApp,
    paraBanco: padraoParaBanco,
  });

function decisao(id: string, over: Partial<Decision> = {}): Decision {
  return {
    id,
    empresa: "cli-03",
    autor: "",
    contexto: "catalogo",
    entidade: { tipo: "pendencia", id: "pen-01" },
    campo: "informacaoPendente",
    valorAnterior: null,
    valorNovo: "Enviar planilha de custos",
    origem: "pendencias.resolverPendencia",
    timestamp: "2026-07-20T10:00:00.000Z",
    correlacao: null,
    ...over,
  };
}

const ordenar = (ps: Padrao[]) => [...ps].sort((a, b) => (a.id < b.id ? -1 : 1));

beforeEach(() => {
  (globalThis as unknown as { window: { localStorage: LocalStorageShim } }).window.localStorage.clear();
});

test("mapper: round-trip Padrao → PadraoRow → Padrao sem perda de informação", async () => {
  const chave = chaveDe(decisao("d1"));
  assert.ok(chave);
  const padrao: Padrao = {
    id: await patternIdDe(chave),
    chave: JSON.stringify([chave.empresa, chave.contexto, chave.campo, chave.valorNovo]),
    empresa: chave.empresa,
    contexto: chave.contexto,
    campo: chave.campo,
    valorNovo: chave.valorNovo,
    ocorrencias: 3,
    decisoesDeSuporte: ["a-1", "b-2", "c-3"],
    primeiraOcorrencia: "2026-07-01T00:00:00.000Z",
    ultimaOcorrencia: "2026-07-20T10:00:00.000Z",
    confidence: "consistente",
    estado: "estabelecido",
    slotEstado: "consistente",
  };
  const linha = { ...padraoParaBanco(padrao), id: padrao.id } as unknown as PadraoRow;
  assert.deepEqual(padraoParaApp(linha), padrao);
});

test("projeção materializa: Decisions → Patterns persistidos com id/chave/contagens corretos", async () => {
  const decisoes = repoDecisoes();
  await decisoes.salvar(decisao("11111111-1111-4111-8111-111111111111", { timestamp: "2026-07-01T00:00:00.000Z" }));
  await decisoes.salvar(decisao("22222222-2222-4222-8222-222222222222", { timestamp: "2026-07-10T00:00:00.000Z" }));
  await decisoes.salvar(decisao("33333333-3333-4333-8333-333333333333", { timestamp: "2026-07-20T00:00:00.000Z" }));

  const computados = await projetarPadroes();
  assert.equal(computados.length, 1);

  const persistidos = await repoPadroes().listar();
  assert.equal(persistidos.length, 1);
  const p = persistidos[0];

  // PatternId preservado — derivado da chave, idêntico ao cálculo independente.
  const chave = chaveDe(decisao("qualquer"));
  assert.ok(chave);
  assert.equal(p.id, await patternIdDe(chave));
  // PatternKey preservada (explicabilidade).
  assert.equal(p.chave, computados[0].chave);
  // Ocorrências, confidence e temporais preservados.
  assert.equal(p.ocorrencias, 3);
  assert.equal(p.confidence, "consistente");
  assert.equal(p.estado, "estabelecido");
  assert.equal(p.primeiraOcorrencia, "2026-07-01T00:00:00.000Z");
  assert.equal(p.ultimaOcorrencia, "2026-07-20T00:00:00.000Z");
  assert.deepEqual(p, computados[0]); // persistido ≡ computado (sem perda)
});

test("replay idempotente: projetar N vezes produz exatamente o mesmo estado", async () => {
  const decisoes = repoDecisoes();
  await decisoes.salvar(decisao("11111111-1111-4111-8111-111111111111"));
  await decisoes.salvar(decisao("44444444-4444-4444-8444-444444444444", { valorNovo: "Enviar acesso do TikTok Shop" }));

  await projetarPadroes();
  const primeira = ordenar(await repoPadroes().listar());
  await projetarPadroes();
  await projetarPadroes();
  const terceira = ordenar(await repoPadroes().listar());

  assert.equal(terceira.length, primeira.length, "re-projeção nunca duplica linhas");
  assert.deepEqual(terceira, primeira, "estado idêntico após N execuções");
});

test("reconstrução integral: a projeção é derivável APENAS do Decision Journal", async () => {
  const decisoes = repoDecisoes();
  await decisoes.salvar(decisao("11111111-1111-4111-8111-111111111111"));
  await decisoes.salvar(decisao("22222222-2222-4222-8222-222222222222"));

  await projetarPadroes();
  const padroes = repoPadroes();
  const antes = ordenar(await padroes.listar());
  assert.ok(antes.length > 0);

  // Perda total da projeção (via Repository) — o Journal permanece.
  for (const p of antes) await padroes.excluir(p.id);
  assert.equal((await padroes.listar()).length, 0);

  await projetarPadroes();
  const reconstruida = ordenar(await padroes.listar());
  assert.deepEqual(reconstruida, antes, "mesmas linhas, mesmos ids — sem estado fora do log");
});
