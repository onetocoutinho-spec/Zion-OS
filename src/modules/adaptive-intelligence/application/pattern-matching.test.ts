// Testes do Contextual Pattern Matching (E4.1).
//
// Cobrem o critério de sucesso: match encontrado/inexistente, confidence
// PRESERVADA (nunca recomputada), explainability disponível, evidências,
// autoria e navegação (o match abre a cadeia completa do Browser).
// 100% puro: repositórios em memória.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/pattern-matching.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "../domain/decision.ts";
import type { Padrao } from "../domain/pattern.ts";
import { carregarDetalhePadrao, type ReposDeLeitura } from "./pattern-browser.ts";
import { corresponder, localizarMemoria, propostaSegue } from "./pattern-matching.ts";

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

const P_TOP = padrao({
  id: "pat-a",
  valorNovo: "MLB273770",
  ocorrencias: 3,
  decisoesDeSuporte: ["d1", "d2"],
  confidence: "consistente",
  estado: "estabelecido",
  slotEstado: "consistente",
});
const P_MENOR = padrao({ id: "pat-b", valorNovo: "MLB999999", decisoesDeSuporte: ["d3"] });
const P_OUTRA_EMPRESA = padrao({ id: "pat-x", valorNovo: "MLB273770", empresa: "cli-99" });
const P_OUTRO_CAMPO = padrao({ id: "pat-y", valorNovo: "149.9", campo: "precoVenda", contexto: "precificacao" });

const DECISOES: Decision[] = [
  {
    id: "d1", empresa: "cli-01", autor: "ana@zion.com", contexto: "catalogo",
    entidade: { tipo: "produto", id: "prd-01" }, campo: "categoriaMarketplace",
    valorAnterior: "MLB111111", valorNovo: "MLB273770",
    origem: "produtos.atualizarProduto", timestamp: "2026-07-05T10:00:00.000Z", correlacao: null,
  },
  {
    id: "d2", empresa: "cli-01", autor: "bia@zion.com", contexto: "catalogo",
    entidade: { tipo: "anuncio", id: "ang-01" }, campo: "categoriaMarketplace",
    valorAnterior: "MLB111111", valorNovo: "MLB273770",
    origem: "api/ml/publicar", timestamp: "2026-07-20T10:00:00.000Z", correlacao: null,
  },
];

function repos(padroes: Padrao[], decisoes: Decision[] = DECISOES): ReposDeLeitura {
  return { padroes: { listar: async () => padroes }, decisoes: { listar: async () => decisoes } };
}

const CTX = { empresa: "cli-01", contexto: "catalogo", campo: "categoriaMarketplace" };

test("match encontrado: só o slot exato, ordem = suporte já contado", () => {
  const r = corresponder(CTX, [P_OUTRO_CAMPO, P_MENOR, P_OUTRA_EMPRESA, P_TOP]);
  assert.deepEqual(r.map((p) => p.id), ["pat-a", "pat-b"]); // empresa/campo alheios ficam fora
});

test("correspondência é canônica no contexto (reusa o domínio congelado)", () => {
  const r = corresponder({ ...CTX, contexto: "  Catalogo " }, [P_TOP]);
  assert.equal(r.length, 1); // NFC+trim+caixa baixa — nunca similaridade
});

test("match inexistente → memória vazia e silenciosa", async () => {
  const m = await localizarMemoria({ ...CTX, campo: "tabelaMedidas" }, repos([P_TOP, P_MENOR]));
  assert.equal(m.encontrada, false);
  assert.equal(m.maisFrequente, null);
  assert.equal(m.propostaSegueMemoria, null);
});

test("confidence PRESERVADA e explicada — nunca recomputada", async () => {
  const m = await localizarMemoria(CTX, repos([P_TOP, P_MENOR]));
  assert.ok(m.maisFrequente);
  assert.equal(m.maisFrequente.confidence, "consistente"); // a materializada, intacta
  assert.match(m.maisFrequente.explicacao, /único valor recorrente/); // limiares congelados
});

test("autoria: último autor vem da evidência de suporte mais recente", async () => {
  const m = await localizarMemoria(CTX, repos([P_TOP, P_MENOR]));
  assert.equal(m.maisFrequente?.ultimoAutor, "bia@zion.com"); // d2 (20/07) > d1 (05/07)
});

test("proposta comparada na forma canônica; ausência → null (nunca opina no vazio)", async () => {
  const alvo = { campo: "categoriaMarketplace", valor: "MLB273770" };
  assert.equal(propostaSegue("  MLB273770 ", alvo), true); // canonicalização estrutural
  assert.equal(propostaSegue("MLB999999", alvo), false);
  assert.equal(propostaSegue("", alvo), null);
  assert.equal(propostaSegue(undefined, alvo), null);
  const m = await localizarMemoria({ ...CTX, proposta: "MLB273770" }, repos([P_TOP]));
  assert.equal(m.propostaSegueMemoria, true);
});

test("disputa sinalizada do estado MATERIALIZADO (sem cálculo novo)", async () => {
  const emDisputa = [
    padrao({ id: "a", valorNovo: "V1", ocorrencias: 2, slotEstado: "em_disputa", confidence: "recorrente" }),
    padrao({ id: "b", valorNovo: "V2", ocorrencias: 2, slotEstado: "em_disputa", confidence: "recorrente" }),
  ];
  const m = await localizarMemoria(CTX, repos(emDisputa));
  assert.equal(m.emDisputa, true);
});

test("navegação: o match abre a cadeia completa do Pattern Browser", async () => {
  const r = repos([P_TOP, P_MENOR]);
  const m = await localizarMemoria(CTX, r);
  assert.ok(m.maisFrequente);
  const detalhe = await carregarDetalhePadrao(m.maisFrequente.id, r); // o MESMO id navega
  assert.ok(detalhe);
  assert.equal(detalhe.evidencias.length, 2); // evidência → Decision → autor
  assert.equal(detalhe.evidencias[0].autor, "bia@zion.com");
  assert.equal(detalhe.concorrentes[0]?.id, "pat-b"); // divergência acessível
});
