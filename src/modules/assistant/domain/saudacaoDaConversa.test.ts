// Cumprimento é cumprimento; pergunta é pergunta.
//
// ===========================================================================
// O DEFEITO QUE ESTES TESTES GUARDAM
// ===========================================================================
//
// A primeira frase escrita no chat, em 05/08/2026, foi "Olá". A resposta foi
// "Não entendi a sua pergunta." O classificador não errou — a lista fechada de
// intenções não tinha lugar para um cumprimento.
//
// E o conserto tem um jeito ERRADO de ser feito, que é o que a segunda metade
// destes testes existe para impedir: casar por PREFIXO. "Bom dia, quantos
// produtos estão sem peso?" começa com um cumprimento e NÃO é um cumprimento.
// Responder "olá!" e engolir a pergunta é pior que a recusa original, porque a
// recusa pelo menos era visível.

import { test } from "node:test";
import assert from "node:assert/strict";

import { ehSaudacao } from "./saudacaoDaConversa.ts";

// ── O que é cumprimento ─────────────────────────────────────────────────────

test("as formas que uma pessoa de verdade escreve", () => {
  const saudacoes = [
    "Olá",
    "olá",
    "ola",
    "Oi",
    "oi!",
    "Olá!",
    "Bom dia",
    "bom dia!",
    "Boa tarde",
    "boa noite",
    "Oi, tudo bem?",
    "oi tudo bem",
    "tudo bem?",
    "tudo bom",
    "Olá, bom dia",
    "bom dia, tudo bem?",
    "e aí",
    "opa",
    "beleza?",
    "blz",
    "hey",
    "hello",
    "Oi, como vai?",
    "alô",
  ];
  for (const s of saudacoes) {
    assert.equal(ehSaudacao(s), true, `"${s}" deveria ser cumprimento`);
  }
});

test("acento e pontuação não decidem nada", () => {
  assert.equal(ehSaudacao("OLÁ!!!"), true);
  assert.equal(ehSaudacao("  olá  "), true);
  assert.equal(ehSaudacao("Alô?"), true);
});

// ── O que NÃO é, e é aqui que o conserto pode dar errado ────────────────────

test("educação na frente de uma pergunta NÃO é cumprimento", () => {
  // O teste que mais importa. Se um destes passar a ser cumprimento, o chat
  // responde "olá!" e a pergunta da lojista desaparece sem aviso.
  const perguntas = [
    "Bom dia, quantos produtos estão sem peso?",
    "oi, o que falta no Moleca 5556?",
    "Olá, por onde eu começo?",
    "boa tarde, como está a loja?",
    "oi tudo bem? quantas infrações eu tenho",
    "olá quero cadastrar um produto",
  ];
  for (const p of perguntas) {
    assert.equal(ehSaudacao(p), false, `"${p}" é uma PERGUNTA e foi tratada como cumprimento`);
  }
});

test("as perguntas reais do roteiro de teste não são cumprimento", () => {
  const perguntas = [
    "quantos produtos estão sem peso?",
    "o que falta no Moleca 5556?",
    "muda o preço do Moleca 5556 para 89,90",
    "quantos anúncios estão otimizados?",
    "por que não consigo publicar?",
    "como vai a loja?",
    "e o preço?",
    "tudo pronto para publicar?",
  ];
  for (const p of perguntas) {
    assert.equal(ehSaudacao(p), false, `"${p}" foi tratada como cumprimento`);
  }
});

test("frase vazia não é cumprimento — a rota já tem a mensagem dela", () => {
  assert.equal(ehSaudacao(""), false);
  assert.equal(ehSaudacao("   "), false);
  assert.equal(ehSaudacao("!!!"), false);
});

test("uma frase longa feita de palavras inocentes não vira cumprimento", () => {
  // O teto de palavras existe para este caso: sem ele, uma frase comprida em
  // que por acaso todas as palavras são inofensivas passaria.
  assert.equal(ehSaudacao("bom bom bom bom bom bom bom bom"), false);
});

test("uma palavra fora do acompanhamento basta para deixar de ser cumprimento", () => {
  // É a regra que separa "bom dia" de "bom dia e a loja". Uma palavra da
  // operação no meio e a frase volta a ser pergunta.
  assert.equal(ehSaudacao("bom dia"), true);
  assert.equal(ehSaudacao("bom dia loja"), false);
  assert.equal(ehSaudacao("oi peso"), false);
});
