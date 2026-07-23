// Testes do Suggestion Engine (E4.2 · R-SE-1).
//
// Cobrem o critério de sucesso: elegibilidade EXATA do contrato PD-001 (sem
// regra a mais), slot inconsistente/em disputa/sem Pattern → silêncio, Offer
// Registration (fato completo, append-only, ANTES da fala; falha no registro →
// sem sugestão), explainability, navegação e retrocompatibilidade (o Engine
// jamais lança para o formulário). 100% puro: repositórios em memória.
// Rodar: npx tsx --test src/modules/adaptive-intelligence/application/suggestion-engine.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import type { Decision } from "../domain/decision.ts";
import { AUTOR_OFERTA, VERSAO_CONTRATO_OFERTA, type Oferta } from "../domain/offer.ts";
import type { Padrao } from "../domain/pattern.ts";
import { carregarDetalhePadrao, type ReposDeLeitura } from "./pattern-browser.ts";
import { localizarMemoria } from "./pattern-matching.ts";
import { gerarSugestao, veredictoElegibilidade, type DepsEngine } from "./suggestion-engine.ts";

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

const P_ELEGIVEL = padrao({
  id: "pat-a",
  valorNovo: "MLB273770",
  ocorrencias: 3,
  decisoesDeSuporte: ["d1", "d2"],
  confidence: "consistente",
  estado: "estabelecido",
  slotEstado: "consistente",
});
const P_RECORRENTE = padrao({
  id: "pat-r",
  valorNovo: "MLB273770",
  ocorrencias: 2,
  decisoesDeSuporte: ["d1"],
  confidence: "recorrente",
  slotEstado: "consistente",
});

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

class RegistroEmMemoria {
  gravadas: Oferta[] = [];
  async salvar(oferta: Oferta): Promise<Oferta> {
    this.gravadas.push(oferta); // append-only: só acumula, jamais substitui
    return oferta;
  }
}

function deps(padroes: Padrao[], registro = new RegistroEmMemoria()): DepsEngine & { registro: RegistroEmMemoria } {
  const leitura: ReposDeLeitura = {
    padroes: { listar: async () => padroes },
    decisoes: { listar: async () => DECISOES },
  };
  return { leitura, ofertas: registro, registro };
}

const CTX = { empresa: "cli-01", contexto: "catalogo", campo: "categoriaMarketplace" };

test("elegível: consistente ∧ slot CONSISTENTE ∧ evidências → Sugestao completa", async () => {
  const d = deps([P_ELEGIVEL]);
  const s = await gerarSugestao(CTX, d);
  assert.ok(s);
  assert.equal(s.valor, "MLB273770");
  assert.equal(s.patternId, "pat-a");
  assert.equal(s.confidence, "consistente"); // preservada, nunca recomputada
  assert.equal(s.ocorrencias, 3);
  assert.equal(s.ultimoAutor, "bia@zion.com");
  assert.match(s.explicacao, /único valor recorrente/); // limiares congelados
  assert.match(s.motivoElegibilidade, /RFC-AIL-005 §6.1/); // contrato citável
});

test("bloqueio: confidence abaixo de consistente → silêncio com motivo", async () => {
  const d = deps([P_RECORRENTE]);
  assert.equal(await gerarSugestao(CTX, d), null);
  assert.equal(d.registro.gravadas.length, 0); // silêncio não registra oferta
  const memoria = await localizarMemoria(CTX, d.leitura);
  assert.match(veredictoElegibilidade(memoria).motivo, /exige "consistente"/);
});

test("bloqueio: slot em disputa → nenhum concorrente sugere", async () => {
  const emDisputa = [
    padrao({ id: "a", valorNovo: "V1", ocorrencias: 3, confidence: "recorrente", slotEstado: "em_disputa", decisoesDeSuporte: ["d1"] }),
    padrao({ id: "b", valorNovo: "V2", ocorrencias: 2, confidence: "recorrente", slotEstado: "em_disputa", decisoesDeSuporte: ["d2"] }),
  ];
  const d = deps(emDisputa);
  assert.equal(await gerarSugestao(CTX, d), null);
  const memoria = await localizarMemoria(CTX, d.leitura);
  assert.match(veredictoElegibilidade(memoria).motivo, /disputa/);
});

test("bloqueio: sem Pattern no slot → silêncio (aditividade)", async () => {
  const d = deps([]);
  assert.equal(await gerarSugestao(CTX, d), null);
  assert.equal(d.registro.gravadas.length, 0);
});

test("Offer Registration: fato completo, com a base congelada no instante", async () => {
  const d = deps([P_ELEGIVEL]);
  const s = await gerarSugestao(
    { ...CTX, entidade: { tipo: "produto", id: "prd-07" }, correlacao: "sessao-1" },
    d
  );
  assert.ok(s);
  assert.equal(d.registro.gravadas.length, 1);
  const o = d.registro.gravadas[0];
  assert.equal(o.id, s.offerId); // a Sugestao aponta o fato que a sustenta
  assert.equal(o.patternId, "pat-a");
  assert.equal(o.valorOferecido, "MLB273770");
  assert.equal(o.confidenceUtilizada, "consistente"); // congelada no instante
  assert.equal(o.ocorrenciasNoMomento, 3);
  assert.deepEqual(o.entidade, { tipo: "produto", id: "prd-07" });
  assert.equal(o.correlacao, "sessao-1");
  assert.equal(o.autorDaOferta, AUTOR_OFERTA); // o sistema ASSINA (S-30)
  assert.equal(o.versaoContrato, VERSAO_CONTRATO_OFERTA);
  assert.ok(o.oferecidaEm && !Number.isNaN(Date.parse(o.oferecidaEm)));
  assert.ok(o.id.length > 0); // OfferId do domínio (R-INF-001)
});

test("append-only: cada geração é um fato novo (nunca mutação)", async () => {
  const d = deps([P_ELEGIVEL]);
  const s1 = await gerarSugestao(CTX, d);
  const s2 = await gerarSugestao(CTX, d);
  assert.ok(s1 && s2);
  assert.notEqual(s1.offerId, s2.offerId);
  assert.equal(d.registro.gravadas.length, 2);
});

test("ADR-001: registro falhou → NÃO há sugestão (não-auditável não existe)", async () => {
  const d = deps([P_ELEGIVEL], {
    gravadas: [],
    async salvar(): Promise<Oferta> {
      throw new Error("registro indisponível");
    },
  } as unknown as RegistroEmMemoria);
  assert.equal(await gerarSugestao(CTX, d), null); // e jamais lança
});

test("navegação: o patternId da Sugestao abre a cadeia completa do Browser", async () => {
  const d = deps([P_ELEGIVEL]);
  const s = await gerarSugestao(CTX, d);
  assert.ok(s);
  const detalhe = await carregarDetalhePadrao(s.patternId, d.leitura);
  assert.ok(detalhe);
  assert.equal(detalhe.evidencias.length, 2); // Suggestion → Pattern → Evidence → Journal
  assert.equal(detalhe.evidencias[0].autor, "bia@zion.com");
});

test("retrocompatibilidade: leitura que lança → null, nunca exceção ao form", async () => {
  const d: DepsEngine = {
    leitura: {
      padroes: { listar: async () => { throw new Error("projeção fora"); } },
      decisoes: { listar: async () => [] },
    },
    ofertas: new RegistroEmMemoria(),
  };
  assert.equal(await gerarSugestao(CTX, d), null);
});
