// A tela distingue CARREGANDO, FALHOU e ESTÁ VAZIO. Os três, não dois.
//
// ===========================================================================
// O DEFEITO — E ELE ESTAVA NA PRIMEIRA TELA
// ===========================================================================
//
// A Visão geral (`/cliente`) abria DEZ consultas e usava só `data` de todas.
// `useLiveQuery` começa em `{ data: null, carregando: true }`, e o cálculo dos
// cartões faz `produtos ?? []`. Resultado: enquanto carregava — e QUANDO
// FALHAVA — a lojista via zero produtos, zero anúncios, nada pendente, nenhuma
// infração. Uma loja vazia e em paz.
//
// Este repositório tem uma regra escrita em dezenas de arquivos:
//
//     zero significa "não sei", nunca um valor.
//
// Ela era aplicada com rigor à PROCEDÊNCIA do dado — `infracoes?: number` é
// opcional justamente para não afirmar conta limpa sem ter olhado — e não era
// aplicada ao ESTADO DE CARGA. O `?? []` fazia o que o `?? 0` é proibido de
// fazer.
//
// A mesma tela já registrava TRÊS consertos desta família nos próprios
// comentários: "Otimizado" com zero avaliados pela IA, "Ativos: 791" contra os
// 491 que o Mercado Livre reporta, e "Sem otimização: 0". Este é o quarto.
//
// ===========================================================================
// POR QUE ESTES TESTES LEEM A FONTE
// ===========================================================================
//
// O que se guarda aqui é a FORMA da tela — quais estados ela distingue — e isso
// não tem valor de retorno para inspecionar sem montar React, banco e sessão.
// A alternativa honesta é ler o código que produz a tela.

import { test } from "node:test";
import assert from "node:assert/strict";

import { lerFonte } from "../../../testing/lerFonte.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => lerFonte(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const HOME = semComentarios(ler("app/cliente/page.tsx"));
const GALERIA = semComentarios(ler("app/cliente/imagens/page.tsx"));
const SUPERFICIE = semComentarios(ler("components/ui/Skeleton.tsx"));

// ── A Visão geral ───────────────────────────────────────────────────────────

test("a Visão geral CONSOME carregando e erro, não só o dado", () => {
  // A raiz do defeito: `const { data: x } = useLiveQuery(...)` dez vezes.
  assert.match(HOME, /carregando:\s*carregandoProdutos/);
  assert.match(HOME, /erro:\s*erroProdutos/);
  assert.match(HOME, /carregando:\s*carregandoAnuncios/);
  assert.match(HOME, /carregando:\s*carregandoImagens/);
});

test("as três consultas que formam os números entram na decisão", () => {
  // Se uma sair da conjunção, os cartões voltam a mostrar zero por aquela.
  assert.match(
    HOME,
    /carregandoOsNumeros\s*=\s*carregandoProdutos\s*\|\|\s*carregandoAnuncios\s*\|\|\s*carregandoImagens/
  );
  assert.match(HOME, /erroDosNumeros\s*=\s*erroProdutos\s*\?\?\s*erroAnuncios\s*\?\?\s*erroImagens/);
});

test("carregar mostra ESQUELETO, e não os cartões com zero", () => {
  assert.match(HOME, /carregandoOsNumeros\s*\?/);
  assert.match(HOME, /EsqueletoDeBloco/);
});

test("falhar mostra a FALHA, e a falha é anunciada", () => {
  // `role="alert"` porque a régua de UI trata "erro só na cor" como defeito de
  // severidade alta: quem não vê o âmbar fica esperando um dado que não vem.
  assert.match(HOME, /erroDosNumeros\s*\?/);
  const alerta = /role="alert"[\s\S]{0,900}?Não consegui ler os números/.test(HOME);
  assert.ok(alerta, "o bloco de erro perdeu o role=alert ou a frase");
});

test("a mensagem de falha NEGA explicitamente a leitura de loja vazia", () => {
  // É a frase que existe por causa do defeito: o risco não é a lojista não ver
  // número, é ela ACREDITAR no zero. Dizer "não quer dizer que está vazia" é o
  // conserto da interpretação, não da renderização.
  assert.match(HOME, /não quer dizer que a loja está vazia/i);
});

test("falhar oferece TENTAR DE NOVO, e o botão recarrega as três", () => {
  // Sem isto o único caminho é recarregar a página inteira — trabalho que o
  // sistema pode fazer por ela.
  assert.match(HOME, /Tentar de novo/);
  for (const f of ["relerProdutos", "relerAnuncios", "relerImagens"]) {
    assert.match(HOME, new RegExp(`${f}\\(\\)`), `o botão não rechama ${f}`);
  }
});

test("os três caminhos são EXCLUSIVOS — carregando, erro, números", () => {
  // Um `&&` no lugar do ternário deixaria o esqueleto e os cartões coexistirem,
  // e aí o zero volta a aparecer junto do esqueleto.
  assert.match(HOME, /carregandoOsNumeros\s*\?[\s\S]*?\)\s*:\s*erroDosNumeros\s*\?/);
});

// ── A primitiva compartilhada ───────────────────────────────────────────────

test("a Superficie também anuncia o erro — ela serve as outras telas", () => {
  assert.match(SUPERFICIE, /role="alert"/);
});

// ── A galeria de fotos ──────────────────────────────────────────────────────

test("os controles da foto existem em TOQUE, não só no hover", () => {
  // Num telefone não existe hover. Antes disto a tela cuja função é gerenciar
  // fotos não tinha, no celular, caminho nenhum para definir a capa — que é o
  // trabalho que o PLANO-001 §A2 aponta como o maior ganho de receita da conta.
  assert.match(GALERIA, /\[@media\(pointer:coarse\)\]:opacity-100/);
  assert.match(GALERIA, /focus-within:opacity-100/, "o teclado também precisa revelar");
});

test("em toque o alvo tem 44px — a régua não aceita 24", () => {
  const alvos = GALERIA.match(/\[@media\(pointer:coarse\)\]:h-11/g) ?? [];
  assert.ok(alvos.length >= 3, `esperava os 3 controles com 44px, achei ${alvos.length}`);
  assert.match(GALERIA, /\[@media\(pointer:coarse\)\]:w-11/);
});

test("os controles têm 8px entre eles, não 4", () => {
  // "Touch Spacing · Do: Minimum 8px gap". `gap-1` é 4px.
  assert.match(GALERIA, /flex flex-col gap-2 opacity-0/);
});

test("cada controle da foto tem nome acessível", () => {
  for (const nome of [/Definir como capa/, /Tirar esta foto do envio/, /Remover esta foto/]) {
    assert.match(GALERIA, new RegExp(`aria-label=[^\\n]*${nome.source}`), `falta aria-label: ${nome}`);
  }
});

test("a foto do produto não é declarada decorativa", () => {
  // `alt=""` diz "ignore esta imagem". Numa tela que GERENCIA fotos de produto
  // ela não é decorativa — a régua: "BAD: alt='' for content images".
  assert.match(GALERIA, /Foto de capa do produto/);
  assert.doesNotMatch(GALERIA, /<img[\s\S]{0,200}?alt=""/, "voltou o alt vazio numa foto de produto");
});

test("a instrução não manda passar o mouse", () => {
  // Consertar o comportamento e deixar o texto velho trocaria um defeito por
  // outro: a tela passaria a funcionar no celular DIZENDO que não funciona.
  assert.doesNotMatch(GALERIA, /Passe o mouse numa foto/);
  assert.match(GALERIA, /No celular/);
});

test("emoji não faz papel de ícone na galeria", () => {
  // A legenda usava ★ 👁 🗑 para descrever botões que desenham SVG do lucide.
  for (const emoji of ["★", "👁", "🗑"]) {
    assert.ok(!GALERIA.includes(emoji), `emoji ${emoji} voltou a ser ícone`);
  }
});
