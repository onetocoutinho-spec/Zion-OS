// Testes dos limites do Mercado Envios.
//
// O que se prova: um pacote grande demais é REPROVADO antes de virar anúncio, e
// — a metade que mais importa — a falta de medida nunca vira aprovação.
// Rodar: npx tsx --test src/modules/integration/domain/limitesDoMercadoEnvios.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cabeNoMercadoEnvios,
  MAIOR_LADO_MAXIMO_CM,
  PESO_MAXIMO_G,
  SOMA_MAXIMA_CM,
} from "./limitesDoMercadoEnvios.ts";

/** Caixa de sapato: o caso que sempre coube e precisa continuar cabendo. */
const CAIXA_DE_SAPATO = { pesoGramas: 800, alturaCm: 12, larguraCm: 20, comprimentoCm: 32 };

// ── O que cabe ───────────────────────────────────────────────────────────────

test("caixa de sapato cabe — o cliente que já está no ar não muda", () => {
  const v = cabeNoMercadoEnvios(CAIXA_DE_SAPATO);
  assert.equal(v.situacao, "cabe");
  assert.deepEqual(v.motivos, []);
});

test("os limites são INCLUSIVOS: exatamente no teto ainda cabe", () => {
  // "até 50 kg", "pode medir 300 cm no total", "não deve exceder 200 cm".
  // Um `>=` no lugar do `>` reprovaria o pacote que o ML aceita.
  const v = cabeNoMercadoEnvios({
    pesoGramas: PESO_MAXIMO_G,
    alturaCm: MAIOR_LADO_MAXIMO_CM,
    larguraCm: 50,
    comprimentoCm: SOMA_MAXIMA_CM - MAIOR_LADO_MAXIMO_CM - 50,
  });
  assert.equal(v.situacao, "cabe");
});

// ── O que não cabe ───────────────────────────────────────────────────────────

test("peso acima do teto reprova SOZINHO, sem nenhuma dimensão medida", () => {
  // Um limite estourado é conclusivo: 60 kg não cabe, tenha alguém medido os
  // lados ou não. É o que separa "não cabe" de "não sei".
  const v = cabeNoMercadoEnvios({
    pesoGramas: 60_000,
    alturaCm: 0,
    larguraCm: 0,
    comprimentoCm: 0,
  });
  assert.equal(v.situacao, "nao_cabe");
  assert.equal(v.motivos.length, 1);
  assert.match(v.motivos[0], /60 kg/);
});

test("um lado acima de 200 cm reprova mesmo com a soma dentro do limite", () => {
  const v = cabeNoMercadoEnvios({
    pesoGramas: 10_000,
    alturaCm: 210,
    larguraCm: 10,
    comprimentoCm: 10,
  });
  assert.equal(v.situacao, "nao_cabe");
  assert.equal(v.motivos.length, 1, "a soma dá 230 — só o lado estourou");
  assert.match(v.motivos[0], /maior lado/);
});

test("a soma acima de 300 cm reprova mesmo com todos os lados abaixo de 200", () => {
  const v = cabeNoMercadoEnvios({
    pesoGramas: 10_000,
    alturaCm: 150,
    larguraCm: 90,
    comprimentoCm: 70,
  });
  assert.equal(v.situacao, "nao_cabe");
  assert.equal(v.motivos.length, 1, "nenhum lado passa de 200 — só a soma estourou");
  assert.match(v.motivos[0], /somam/);
});

test("a cama do catálogo de móveis: dois limites estourados, dois motivos", () => {
  // 202 × 93 × 155 — o caso real que motivou este módulo. Maior lado 202 (> 200)
  // e soma 450 (> 300). Dizer só um dos dois faria a lojista corrigir uma coisa
  // e ser reprovada de novo pela outra.
  const v = cabeNoMercadoEnvios({
    pesoGramas: 40_000,
    alturaCm: 202,
    larguraCm: 93,
    comprimentoCm: 155,
  });
  assert.equal(v.situacao, "nao_cabe");
  assert.equal(v.motivos.length, 2);
  assert.ok(v.motivos.some((m) => /maior lado/.test(m)));
  assert.ok(v.motivos.some((m) => /somam/.test(m)));
});

// ── O que não se sabe — a metade que impede a mentira ────────────────────────

test("sem pacote nenhum: não se afirma nada", () => {
  assert.deepEqual(cabeNoMercadoEnvios(null), { situacao: "sem_medidas", motivos: [] });
});

test("tudo zerado é AUSÊNCIA de medida, não um pacote de tamanho zero", () => {
  const v = cabeNoMercadoEnvios({
    pesoGramas: 0,
    alturaCm: 0,
    larguraCm: 0,
    comprimentoCm: 0,
  });
  assert.equal(v.situacao, "sem_medidas");
});

test("medida PARCIAL sem estouro não é aprovação — o lado que falta pode ser o que estoura", () => {
  // Este é o teste que impede o defeito mais provável desta função: concluir
  // "cabe" porque nada do pouco que se mediu passou do limite.
  const v = cabeNoMercadoEnvios({
    pesoGramas: 5_000,
    alturaCm: 30,
    larguraCm: 20,
    comprimentoCm: 0, // ninguém mediu
  });
  assert.equal(v.situacao, "sem_medidas");
  assert.deepEqual(v.motivos, []);
});

test("peso sem dimensões, dentro do limite, também é 'não sei'", () => {
  const v = cabeNoMercadoEnvios({
    pesoGramas: 800,
    alturaCm: 0,
    larguraCm: 0,
    comprimentoCm: 0,
  });
  assert.equal(v.situacao, "sem_medidas");
});

// ── Entrada suja ─────────────────────────────────────────────────────────────

test("número inválido ou negativo não explode nem vira aprovação", () => {
  const sujo = {
    pesoGramas: Number.NaN,
    alturaCm: -50,
    larguraCm: 20,
    comprimentoCm: 30,
  } as { pesoGramas: number; alturaCm: number; larguraCm: number; comprimentoCm: number };
  const v = cabeNoMercadoEnvios(sujo);
  assert.equal(v.situacao, "sem_medidas");
});
