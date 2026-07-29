// Testes da Offer Observation (E5.0).
//
// Cobrem as três classes de evidência (respondida_igual/diferente/sem_resposta),
// a correspondência por slot+entidade, a escolha determinística da PRIMEIRA
// resposta, a comparação canônica, o tempo-até-resposta e o carregamento por
// empresa. 100% puro: repositórios em memória, zero escrita.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/offer-observation.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "../domain/decision.ts";
import { AUTOR_OFERTA, VERSAO_CONTRATO_OFERTA, type Oferta } from "../domain/offer.ts";
import { observarOferta, observarOfertas, type ReposObservacao } from "./offer-observation.ts";

function oferta(o: Partial<Oferta> & { id: string }): Oferta {
  const base = {
    id: o.id,
    oferecidaEm: "2026-07-22T10:00:00.000Z",
    empresa: "cli-01",
    contexto: "catalogo",
    campo: "categoriaMarketplace",
    entidade: { tipo: "produto", id: "prd-01" },
    patternId: "pat-a",
    valorOferecido: "MLB273770",
    confidenceUtilizada: "consistente",
    ocorrenciasNoMomento: 3,
    autorDaOferta: AUTOR_OFERTA,
    versaoContrato: VERSAO_CONTRATO_OFERTA,
    origemExplicacao: "explicarConfidence(RFC-AIL-004 §4.3/§4.4)",
    // Faltavam TRÊS campos, não um. O `...o` no fim tornava tudo opcional aos
    // olhos do TS, e o fixture montava uma Oferta que o contrato não aceita.
    versaoEngine: null,
    versaoConfidence: null,
    versaoExplainability: null,
    correlacao: null,
  } satisfies Oferta;
  // `satisfies` na BASE é a garantia que importa: campo novo obrigatório em
  // Oferta quebra a compilação aqui. O cast cobre só a mesclagem, porque
  // `Partial<T>` reintroduz `undefined` em cada chave sem
  // `exactOptionalPropertyTypes` — limitação do TS, não do fixture.
  return { ...base, ...o } as Oferta;
}

function decisao(d: Partial<Decision> & { id: string; timestamp: string }): Decision {
  return {
    empresa: "cli-01",
    autor: "ana@zion.com",
    contexto: "catalogo",
    entidade: { tipo: "produto", id: "prd-01" },
    campo: "categoriaMarketplace",
    valorAnterior: null,
    valorNovo: "MLB273770",
    origem: "produtos.atualizarProduto",
    correlacao: null,
    ...d,
  };
}

const OFERTA = oferta({ id: "ofr-1" });

test("respondida_igual: Decision posterior com o valor oferecido → 'aceita'", () => {
  const obs = observarOferta(OFERTA, [
    decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z", valorNovo: "MLB273770" }),
  ]);
  assert.equal(obs.classe, "respondida_igual");
  assert.equal(obs.resposta?.decisionId, "d1");
  assert.equal(obs.resposta?.autor, "ana@zion.com");
  assert.equal(obs.resposta?.tempoAteRespostaMs, 5 * 60 * 1000); // E5.2: quanto tempo levou
});

test("comparação é CANÔNICA: espaços/forma não geram falso 'diferente'", () => {
  const obs = observarOferta(OFERTA, [
    decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z", valorNovo: "  MLB273770 " }),
  ]);
  assert.equal(obs.classe, "respondida_igual");
});

test("respondida_diferente: outro valor → 'editada/contradita' (indistinguíveis — limite declarado)", () => {
  const obs = observarOferta(OFERTA, [
    decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z", valorNovo: "MLB999999" }),
  ]);
  assert.equal(obs.classe, "respondida_diferente");
  assert.equal(obs.resposta?.valorNovo, "MLB999999");
});

test("sem_resposta: nada posterior → 'ignorada ATÉ AGORA' (nunca fechada por janela)", () => {
  const anteriores = [decisao({ id: "d0", timestamp: "2026-07-22T09:00:00.000Z" })];
  const obs = observarOferta(OFERTA, anteriores);
  assert.equal(obs.classe, "sem_resposta");
  assert.equal(obs.resposta, null);
});

test("correspondência exige a MESMA entidade quando a oferta tem entidade", () => {
  const obs = observarOferta(OFERTA, [
    decisao({
      id: "d1",
      timestamp: "2026-07-22T10:05:00.000Z",
      entidade: { tipo: "produto", id: "prd-OUTRO" },
    }),
  ]);
  assert.equal(obs.classe, "sem_resposta"); // outra entidade não responde esta oferta
});

test("oferta em CRIAÇÃO (entidade null): correspondência por slot", () => {
  const emCriacao = oferta({ id: "ofr-2", entidade: null });
  const obs = observarOferta(emCriacao, [
    decisao({
      id: "d1",
      timestamp: "2026-07-22T10:05:00.000Z",
      entidade: { tipo: "produto", id: "prd-novo" },
    }),
  ]);
  assert.equal(obs.classe, "respondida_igual");
});

test("a resposta é a PRIMEIRA posterior (determinística); demais viram subsequentes", () => {
  const obs = observarOferta(OFERTA, [
    decisao({ id: "d2", timestamp: "2026-07-22T11:00:00.000Z", valorNovo: "MLB999999" }),
    decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z", valorNovo: "MLB273770" }),
  ]);
  assert.equal(obs.resposta?.decisionId, "d1"); // ordem por timestamp, não por chegada
  assert.equal(obs.classe, "respondida_igual");
  assert.equal(obs.respostasSubsequentes, 1);
});

test("slot diferente (campo/contexto/empresa) nunca corresponde", () => {
  const obs = observarOferta(OFERTA, [
    decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z", campo: "precoVenda" }),
    decisao({ id: "d2", timestamp: "2026-07-22T10:05:00.000Z", contexto: "publicacao" }),
    decisao({ id: "d3", timestamp: "2026-07-22T10:05:00.000Z", empresa: "cli-99" }),
  ]);
  assert.equal(obs.classe, "sem_resposta");
});

test("observarOfertas: cruza os dois logs, recentes primeiro, zero escrita", async () => {
  const o1 = oferta({ id: "ofr-1", oferecidaEm: "2026-07-22T10:00:00.000Z" });
  const o2 = oferta({ id: "ofr-2", oferecidaEm: "2026-07-22T12:00:00.000Z", entidade: null });
  const repos: ReposObservacao = {
    ofertas: { listar: async () => [o1, o2] },
    padroes: { listar: async () => [] },
    decisoes: {
      listar: async () => [
        decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z", valorNovo: "MLB273770" }),
      ],
    },
  };
  const obs = await observarOfertas("cli-01", repos);
  assert.equal(obs.length, 2);
  assert.equal(obs[0].oferta.id, "ofr-2"); // mais recente primeiro
  assert.equal(obs[0].classe, "sem_resposta"); // d1 é ANTERIOR à oferta 2
  assert.equal(obs[1].classe, "respondida_igual");
});

test("autoria anônima na resposta aparece como 'não registrado'", () => {
  const obs = observarOferta(OFERTA, [
    decisao({ id: "d1", timestamp: "2026-07-22T10:05:00.000Z", autor: "" }),
  ]);
  assert.equal(obs.resposta?.autor, "não registrado");
});
