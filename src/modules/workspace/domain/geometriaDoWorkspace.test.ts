import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BREAKPOINTS,
  CONVERSA_NO_SPLIT_PX,
  CONVERSA_SOZINHA_MAX_PX,
  DRILL_DOWN,
  GAP_DO_SPLIT_PX,
  MINIMO_DA_CONVERSA_PX,
  MINIMO_DO_WORKSPACE_PX,
  TETO_DO_CONTEUDO_PX,
  UTIL_MINIMO_PARA_SPLIT,
  colunasDaTabelaNoWorkspace,
  comportaSplit,
  comportamentoDaSidebar,
  larguraDaConversa,
  larguraDoWorkspace,
  larguraUtilPx,
  paddingHorizontalPx,
} from "./geometriaDoWorkspace.ts";

// ---------------------------------------------------------------------------
// A largura útil — o número de que todo o resto depende
// ---------------------------------------------------------------------------

test("larguraUtilPx: o max-w-5xl é um TETO — a largura útil não cresce depois dele", () => {
  assert.equal(larguraUtilPx(1328), TETO_DO_CONTEUDO_PX);
  assert.equal(larguraUtilPx(1536), TETO_DO_CONTEUDO_PX);
  assert.equal(larguraUtilPx(2560), TETO_DO_CONTEUDO_PX);
});

test("larguraUtilPx: os números medidos do shell", () => {
  assert.equal(larguraUtilPx(BREAKPOINTS.lg), 720); // 1024 - 240 - 64
  assert.equal(larguraUtilPx(BREAKPOINTS.xl), 976); // 1280 - 240 - 64
});

test("larguraUtilPx: abaixo de lg a sidebar é gaveta e NÃO desconta", () => {
  // 768 - 48 (sm:px-6) = 720. Se a sidebar descontasse, daria 480.
  assert.equal(larguraUtilPx(BREAKPOINTS.md), 720);
});

test("larguraUtilPx: nunca negativa", () => {
  assert.equal(larguraUtilPx(0), 0);
  assert.ok(larguraUtilPx(200) >= 0);
});

test("paddingHorizontalPx: acompanha px-4 / sm:px-6 / lg:px-8", () => {
  assert.equal(paddingHorizontalPx(375), 32);
  assert.equal(paddingHorizontalPx(BREAKPOINTS.sm), 48);
  assert.equal(paddingHorizontalPx(BREAKPOINTS.lg), 64);
});

// ---------------------------------------------------------------------------
// D4 — onde o split deixa de existir
// ---------------------------------------------------------------------------

test("D4: o split NÃO cabe em lg — 720 úteis contra 796 necessários", () => {
  assert.equal(comportaSplit(BREAKPOINTS.lg), false);
});

test("D4: o split cabe em xl", () => {
  assert.equal(comportaSplit(BREAKPOINTS.xl), true);
});

test("D4: o necessário usa a largura REAL da conversa, não o mínimo teórico", () => {
  // A primeira versão somava MINIMO_DA_CONVERSA_PX (360) e o teste pegou:
  // a 844px dizia "cabe" e entregava 400px de workspace, abaixo do mínimo dele.
  assert.equal(UTIL_MINIMO_PARA_SPLIT, 816);
  assert.ok(UTIL_MINIMO_PARA_SPLIT > MINIMO_DA_CONVERSA_PX + GAP_DO_SPLIT_PX + MINIMO_DO_WORKSPACE_PX);
});

test("D4: abaixo de xl não há split, mesmo quando a aritmética sobraria", () => {
  // 844px: sem sidebar (gaveta) sobram 796 úteis. Perto do suficiente, e é
  // tablet — território que esta vertical não resolve.
  assert.equal(comportaSplit(844), false);
  // 1200px: 1200 - 240 - 64 = 896 úteis, MAIS que os 816 necessários. Ainda
  // assim não: está abaixo de xl.
  assert.ok(larguraUtilPx(1200) > UTIL_MINIMO_PARA_SPLIT);
  assert.equal(comportaSplit(1200), false);
});

test("D4: comportaSplit é monotônico — nunca deixa de caber ao crescer", () => {
  let viuTrue = false;
  for (let v = 320; v <= 2000; v += 4) {
    const cabe = comportaSplit(v);
    if (cabe) viuTrue = true;
    else if (viuTrue) assert.fail(`split deixou de caber ao crescer, em ${v}px`);
  }
});

// ---------------------------------------------------------------------------
// D1 e D2 — as duas larguras
// ---------------------------------------------------------------------------

test("D1: a conversa sozinha é limitada e centrada — não estica até 1024", () => {
  const c = larguraDaConversa(1536, false);
  assert.equal(c.px, CONVERSA_SOZINHA_MAX_PX);
  assert.equal(c.centrada, true);
  assert.ok(c.px < TETO_DO_CONTEUDO_PX);
});

test("D1: no split a conversa é fixa em 380", () => {
  const c = larguraDaConversa(BREAKPOINTS.xl, true);
  assert.equal(c.px, CONVERSA_NO_SPLIT_PX);
  assert.equal(c.fixa, true);
  assert.equal(c.centrada, false);
});

test("D1: pedir workspace numa janela que não comporta split devolve conversa sozinha", () => {
  const c = larguraDaConversa(BREAKPOINTS.lg, true);
  assert.equal(c.fixa, false);
  assert.equal(c.centrada, true);
});

test("D1: em janela estreita a conversa não passa da largura útil", () => {
  const c = larguraDaConversa(375, false);
  assert.equal(c.px, larguraUtilPx(375));
});

test("D2: o workspace absorve a variação — 580 em xl, 628 no teto", () => {
  assert.equal(larguraDoWorkspace(BREAKPOINTS.xl), 580);
  assert.equal(larguraDoWorkspace(1328), 628);
  assert.equal(larguraDoWorkspace(1536), 628);
});

test("D2: o workspace NUNCA chega aos 660px que eu havia calculado antes", () => {
  // A falsificação da arquitetura C dizia 660px a 1280. Ignorava o max-w-5xl.
  // A conclusão (B e C dão a mesma tabela) sobrevive; o número não.
  for (const v of [BREAKPOINTS.xl, 1328, 1440, 1536, 2560]) {
    const w = larguraDoWorkspace(v);
    assert.ok(w !== null && w < 660, `${v}px deu ${w}px de workspace`);
  }
});

test("D2: sem split o workspace não tem largura — ele muda de forma", () => {
  assert.equal(larguraDoWorkspace(BREAKPOINTS.lg), null);
  assert.equal(larguraDoWorkspace(375), null);
});

test("D2: quando existe, o workspace respeita o próprio mínimo", () => {
  for (let v = 320; v <= 2560; v += 4) {
    const w = larguraDoWorkspace(v);
    if (w !== null) assert.ok(w >= MINIMO_DO_WORKSPACE_PX, `${v}px deu ${w}px`);
  }
});

test("D1+D2: conversa + gap + workspace nunca excede a largura útil", () => {
  for (let v = 1280; v <= 2560; v += 4) {
    const w = larguraDoWorkspace(v);
    if (w === null) continue;
    assert.equal(CONVERSA_NO_SPLIT_PX + GAP_DO_SPLIT_PX + w, larguraUtilPx(v));
  }
});

// ---------------------------------------------------------------------------
// D3 — a sidebar
// ---------------------------------------------------------------------------

test("D3: a sidebar NUNCA colapsa por causa do split", () => {
  for (const v of [375, 768, 1024, 1280, 1536, 2560]) {
    assert.equal(comportamentoDaSidebar(v).colapsaNoSplit, false);
  }
});

test("D3: fixa em 240 a partir de lg; gaveta abaixo", () => {
  assert.deepEqual(comportamentoDaSidebar(1280), {
    forma: "fixa",
    px: 240,
    colapsaNoSplit: false,
  });
  assert.equal(comportamentoDaSidebar(768).forma, "gaveta");
});

// ---------------------------------------------------------------------------
// D5 — drill-down
// ---------------------------------------------------------------------------

test("D5: o drill-down substitui o workspace e não abre terceira coluna", () => {
  assert.equal(DRILL_DOWN.forma, "substitui-o-workspace");
  assert.equal(DRILL_DOWN.preservaAConversa, true);
  assert.equal(DRILL_DOWN.temVolta, true);
});

test("D5: três colunas não cabem em NENHUMA janela — o teto fecha a porta", () => {
  const tresColunas =
    CONVERSA_NO_SPLIT_PX + GAP_DO_SPLIT_PX + MINIMO_DO_WORKSPACE_PX + GAP_DO_SPLIT_PX + MINIMO_DO_WORKSPACE_PX;
  assert.ok(tresColunas > TETO_DO_CONTEUDO_PX, `${tresColunas} caberia no teto de ${TETO_DO_CONTEUDO_PX}`);
  assert.equal(DRILL_DOWN.profundidadeMaxima, 1);
});

// ---------------------------------------------------------------------------
// A tabela dentro do workspace
// ---------------------------------------------------------------------------

test("colunasDaTabelaNoWorkspace: sempre pelo menos identidade + uma", () => {
  for (let v = 320; v <= 2560; v += 8) {
    assert.ok(colunasDaTabelaNoWorkspace(v) >= 2, `${v}px`);
  }
});

test("colunasDaTabelaNoWorkspace: mais espaço não reduz colunas", () => {
  const emXl = colunasDaTabelaNoWorkspace(BREAKPOINTS.xl);
  const noTeto = colunasDaTabelaNoWorkspace(1536);
  assert.ok(noTeto >= emXl);
});
