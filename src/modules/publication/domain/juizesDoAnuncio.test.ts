// Quem decide se um texto gerado merece chegar à lojista é o DOMÍNIO.
//
// O modelo gera; o domínio julga. É a mesma divisão que já vale para o título,
// e existe porque "o modelo achou bom" não é critério — texto vazio, igual ao
// atual, ou mais pobre que o atual são recusas objetivas, e a recusa vira
// frase que ela lê em vez de troca silenciosa.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  avaliarDescricaoProposta,
  avaliarPalavrasChave,
  MINIMO_DE_DESCRICAO,
  MAXIMO_DE_PALAVRAS_CHAVE,
} from "./preparacaoDoAnuncio.ts";

const BOA = "x".repeat(MINIMO_DE_DESCRICAO + 10);

test("descrição vazia é recusada", () => {
  const v = avaliarDescricaoProposta("   ", "atual");
  assert.equal(v.ok, false);
});

test("descrição IGUAL à atual é recusada — não há o que trocar", () => {
  const v = avaliarDescricaoProposta(BOA, BOA);
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : "", /igual/);
});

test("descrição MAIS POBRE que o mínimo é recusada", () => {
  // Trocar uma descrição existente por uma de duas linhas é dano que ninguém
  // pediu. A recusa é honesta: "não consegui gerar algo melhor".
  const v = avaliarDescricaoProposta("Sandália preta.", "uma descrição longa e útil");
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : "", /pobre|caracteres/);
});

test("descrição boa passa, e vem aparada", () => {
  const v = avaliarDescricaoProposta(`  ${BOA}  `, "outra coisa");
  assert.equal(v.ok, true);
  assert.equal(v.ok === true ? v.descricao : "", BOA);
});

test("palavras-chave repetidas somem — acento e caixa não fazem termo novo", () => {
  const v = avaliarPalavrasChave(["Sandália", "sandalia", "SANDÁLIA", "conforto"], []);
  assert.equal(v.ok, true);
  assert.deepEqual(v.ok === true ? [...v.palavras] : [], ["Sandália", "conforto"]);
});

test("palavras que o anúncio JÁ TEM não são proposta", () => {
  // Propor o que já está lá faria a lojista conferir ruído.
  const v = avaliarPalavrasChave(["Havaianas", "chinelo"], ["havaianas"]);
  assert.equal(v.ok, true);
  assert.deepEqual(v.ok === true ? [...v.palavras] : [], ["chinelo"]);
});

test("quando TODAS já estão lá, recusa dizendo isso", () => {
  const v = avaliarPalavrasChave(["chinelo", "Chinelo"], ["CHINELO"]);
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : "", /já estão/);
});

test("lista cheia é RECUSADA, não cortada em silêncio", () => {
  // Cortar esconderia que o modelo encheu lista em vez de achar termo.
  const muitas = Array.from({ length: MAXIMO_DE_PALAVRAS_CHAVE + 1 }, (_, i) => `termo${i}`);
  const v = avaliarPalavrasChave(muitas, []);
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : "", /lista cheia/);
});

test("o domínio LIMPA, mas não ESCOLHE quais valem", () => {
  // Limpeza é objetiva (vazias, repetidas, já existentes). Escolher quais
  // palavras vendem seria opinião, e a opinião sobre isso é da lojista.
  const v = avaliarPalavrasChave(["", "  ", "conforto", "verão"], []);
  assert.equal(v.ok, true);
  assert.deepEqual(v.ok === true ? [...v.palavras] : [], ["conforto", "verão"]);
});

// ---------------------------------------------------------------------------
// O TETO DE SAÍDA CABE NO QUE SE PEDE
// ---------------------------------------------------------------------------
//
// Medido em produção em 10/08/2026: `maxTokens: 1600` — copiado do agente de
// TÍTULO, onde 400 sobra porque um título tem 60 caracteres — cortou o JSON da
// descrição no meio de uma string. `JSON.parse` estourou, o `catch` devolveu
// `null`, e a lojista leu "não consegui gerar uma descrição agora": uma frase
// honesta sobre um defeito que não tinha nada de temporário.
//
// As descrições reais desta base têm 1.600 a 1.900 caracteres.

test("o teto de saída da DESCRIÇÃO comporta uma descrição real", () => {
  const agente = readFileSync(
    new URL("../../../lib/services/agenteDeDescricao.ts", import.meta.url),
    "utf8"
  );
  const bloco = agente.slice(
    agente.indexOf("ESQUEMA_DESCRICAO,"),
    agente.indexOf("ESQUEMA_PALAVRAS")
  );
  const teto = Number((bloco.match(/maxTokens:\s*(\d+)/) ?? [])[1] ?? 0);
  assert.ok(
    teto >= 4000,
    `teto de ${teto} tokens: uma descrição de 1.900 caracteres com acentos e envelope JSON volta cortada, e o erro sai como "não consegui gerar agora"`
  );
});

test("o teto das PALAVRAS-CHAVE continua modesto — vinte termos não precisam de mais", () => {
  // O oposto do anterior: aqui um teto grande só convidaria lista cheia.
  const agente = readFileSync(
    new URL("../../../lib/services/agenteDeDescricao.ts", import.meta.url),
    "utf8"
  );
  const bloco = agente.slice(agente.indexOf("ESQUEMA_PALAVRAS,"));
  const teto = Number((bloco.match(/maxTokens:\s*(\d+)/) ?? [])[1] ?? 0);
  assert.ok(teto > 0 && teto <= 2000, `teto de ${teto} tokens para 20 termos é folga demais`);
});
