// Testes do Pattern Browser (E4.0) — a camada de LEITURA da AIL.
//
// Cobrem o critério de sucesso da missão: carregamento, explainability,
// confidence, autor, evidência e navegação (slots/concorrentes) — tudo
// derivado das projeções, nada inferido. 100% puro: repositórios em memória.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/pattern-browser.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "../domain/decision.ts";
import type { Padrao } from "../domain/pattern.ts";
import {
  agruparPorSlot,
  carregarDetalhePadrao,
  carregarSlots,
  explicarConfidence,
  montarDetalhe,
  rotuloAutor,
  type ReposDeLeitura,
} from "./pattern-browser.ts";

function padrao(p: Partial<Padrao> & { id: string; valorNovo: string }): Padrao {
  return {
    chave: JSON.stringify(["cli-01", "catalogo", "categoriaMarketplace", p.valorNovo]),
    empresa: "cli-01",
    contexto: "catalogo",
    campo: "categoriaMarketplace",
    ocorrencias: 1,
    decisoesDeSuporte: [],
    primeiraOcorrencia: "2026-07-01T10:00:00.000Z",
    ultimaOcorrencia: "2026-07-20T10:00:00.000Z",
    confidence: "observado",
    estado: "emergente",
    slotEstado: "emergente",
    ...p,
  };
}

function decisao(d: Partial<Decision> & { id: string }): Decision {
  return {
    empresa: "cli-01",
    autor: "",
    contexto: "catalogo",
    entidade: { tipo: "produto", id: "prd-01" },
    campo: "categoriaMarketplace",
    valorAnterior: "MLB111111",
    valorNovo: "MLB273770",
    origem: "produtos.atualizarProduto",
    timestamp: "2026-07-10T10:00:00.000Z",
    correlacao: null,
    ...d,
  };
}

const P_CONSISTENTE = padrao({
  id: "pat-a",
  valorNovo: "MLB273770",
  ocorrencias: 3,
  decisoesDeSuporte: ["d1", "d2", "d3"],
  confidence: "consistente",
  estado: "estabelecido",
  slotEstado: "consistente",
});
const P_CONCORRENTE = padrao({
  id: "pat-b",
  valorNovo: "MLB999999",
  decisoesDeSuporte: ["d4"],
  slotEstado: "consistente",
});
const P_OUTRO_SLOT = padrao({
  id: "pat-c",
  campo: "precoVenda",
  contexto: "precificacao",
  valorNovo: "149.9",
  decisoesDeSuporte: ["d5"],
});

const DECISOES: Decision[] = [
  decisao({ id: "d1", autor: "ana@zion.com", timestamp: "2026-07-01T10:00:00.000Z" }),
  decisao({ id: "d2", autor: "", timestamp: "2026-07-10T10:00:00.000Z" }),
  decisao({ id: "d3", autor: "bia@zion.com", timestamp: "2026-07-20T10:00:00.000Z" }),
  decisao({ id: "d-fora", autor: "x@zion.com" }), // da empresa, mas NÃO é suporte
];

function repos(padroes: Padrao[], decisoes: Decision[]): ReposDeLeitura {
  return {
    padroes: { listar: async () => padroes },
    decisoes: { listar: async () => decisoes },
  };
}

test("carregamento: Patterns agrupados por slot, ordenados por suporte", async () => {
  const slots = await carregarSlots(repos([P_OUTRO_SLOT, P_CONCORRENTE, P_CONSISTENTE], []));
  assert.equal(slots.length, 2); // 2 slots distintos
  const slotCategoria = slots.find((s) => s.campo === "categoriaMarketplace");
  assert.ok(slotCategoria);
  assert.equal(slotCategoria.padroes.length, 2);
  assert.equal(slotCategoria.padroes[0].id, "pat-a"); // maior suporte primeiro
  assert.equal(slotCategoria.emDisputa, false);
});

test("navegação: slot em disputa é sinalizado sem cálculo novo", () => {
  const emDisputa = padrao({ id: "x", valorNovo: "V", ocorrencias: 2, slotEstado: "em_disputa" });
  const slots = agruparPorSlot([emDisputa]);
  assert.equal(slots[0].emDisputa, true); // vem do estado MATERIALIZADO
});

test("confidence: explicação derivada dos limiares congelados (§4.3/§4.4)", () => {
  assert.match(explicarConfidence(P_CONSISTENTE), /3 decisões distintas/);
  assert.match(explicarConfidence(P_CONSISTENTE), /único valor recorrente/);
  assert.match(explicarConfidence(P_CONCORRENTE), /observação isolada/);
  const rebaixado = padrao({
    id: "r",
    valorNovo: "V",
    ocorrencias: 3,
    confidence: "recorrente",
    slotEstado: "em_disputa",
  });
  assert.match(explicarConfidence(rebaixado), /disputa bloqueia a graduação/);
});

test("evidência: só as Decisions de suporte, mais recente primeiro", () => {
  const detalhe = montarDetalhe(P_CONSISTENTE, DECISOES, [P_CONSISTENTE, P_CONCORRENTE]);
  assert.equal(detalhe.evidencias.length, 3); // d-fora NÃO entra (não é suporte)
  assert.deepEqual(
    detalhe.evidencias.map((e) => e.id),
    ["d3", "d2", "d1"]
  );
  assert.equal(detalhe.evidencias[0].valorAnterior, "MLB111111"); // proposta rastreada
});

test("autor: último autor real; anônimas aparecem como 'não registrado'", () => {
  const detalhe = montarDetalhe(P_CONSISTENTE, DECISOES, [P_CONSISTENTE]);
  assert.equal(detalhe.ultimoAutor, "bia@zion.com"); // autor da evidência mais recente
  assert.deepEqual(detalhe.autores.sort(), ["ana@zion.com", "bia@zion.com", "não registrado"]);
  assert.equal(rotuloAutor(""), "não registrado");
  assert.equal(rotuloAutor("  "), "não registrado");
});

test("navegação relacionada: concorrentes = MESMO slot, nunca outro", () => {
  const detalhe = montarDetalhe(P_CONSISTENTE, DECISOES, [
    P_CONSISTENTE,
    P_CONCORRENTE,
    P_OUTRO_SLOT,
  ]);
  assert.equal(detalhe.concorrentes.length, 1);
  assert.equal(detalhe.concorrentes[0].id, "pat-b"); // precoVenda fica de fora
});

test("detalhe por id: existente carrega completo; inexistente → null", async () => {
  const r = repos([P_CONSISTENTE, P_CONCORRENTE], DECISOES);
  const detalhe = await carregarDetalhePadrao("pat-a", r);
  assert.ok(detalhe);
  assert.equal(detalhe.valor, "MLB273770");
  assert.equal(detalhe.ocorrencias, 3);
  assert.equal(detalhe.evidencias.length, 3);
  assert.equal(await carregarDetalhePadrao("pat-zzz", r), null);
});
