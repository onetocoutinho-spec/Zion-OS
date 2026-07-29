import test from "node:test";
import assert from "node:assert/strict";

import { blocosDoMarkdown, trechosDaLinha, type Bloco } from "./markdownDaResposta";

const tipos = (bs: Bloco[]) => bs.map((b) => b.tipo);

test("texto simples vira um parágrafo", () => {
  const b = blocosDoMarkdown("Existem 43 produtos sem custo.");
  assert.deepEqual(tipos(b), ["paragrafo"]);
});

test("negrito e código viram trechos, não texto cru", () => {
  const t = trechosDaLinha("São **43** de `73` produtos.");
  assert.deepEqual(t, [
    { tipo: "texto", texto: "São " },
    { tipo: "forte", texto: "43" },
    { tipo: "texto", texto: " de " },
    { tipo: "codigo", texto: "73" },
    { tipo: "texto", texto: " produtos." },
  ]);
});

test("asterisco DENTRO de código não vira ênfase", () => {
  // Por isso `código` é resolvido antes de **negrito**.
  const t = trechosDaLinha("use `a ** b` aqui");
  assert.equal(t.length, 3);
  assert.deepEqual(t[1], { tipo: "codigo", texto: "a ** b" });
});

test("linha sem ênfase nenhuma ainda devolve um trecho", () => {
  assert.deepEqual(trechosDaLinha("nada aqui"), [{ tipo: "texto", texto: "nada aqui" }]);
});

test("tabela vira cabeçalho e linhas", () => {
  const md = ["| Produto | Falta |", "|---|---|", "| Chinelo | peso |", "| Papete | custo |"].join(
    "\n"
  );
  const [b] = blocosDoMarkdown(md);
  assert.equal(b.tipo, "tabela");
  assert.deepEqual(b.cabecalho, ["Produto", "Falta"]);
  assert.equal(b.linhas.length, 2);
  assert.deepEqual(b.linhas[1], ["Papete", "custo"]);
});

test("pipe sem linha separadora NÃO vira tabela", () => {
  // Senão qualquer frase com | viraria uma tabela de uma coluna.
  const b = blocosDoMarkdown("| isso não é tabela");
  assert.deepEqual(tipos(b), ["paragrafo"]);
});

test("lista com marcador e lista numerada são distinguidas", () => {
  // `assert.equal` não estreita a união para o compilador; `ok(cond)` sim.
  // Sem isso o teste lê `.ordenada` num `Bloco` que pode ser tabela.
  const [b1] = blocosDoMarkdown("- um\n- dois");
  assert.ok(b1.tipo === "lista");
  assert.equal(b1.ordenada, false);
  assert.equal(b1.itens.length, 2);

  const [b2] = blocosDoMarkdown("1. um\n2. dois");
  assert.ok(b2.tipo === "lista");
  assert.equal(b2.ordenada, true);
});

test("lista numerada não se funde com a de marcador", () => {
  const b = blocosDoMarkdown("- um\n1. dois");
  assert.deepEqual(tipos(b), ["lista", "lista"]);
});

test("título de nível 2 e 3", () => {
  const b = blocosDoMarkdown("## Dois\n### Três");
  assert.deepEqual(tipos(b), ["titulo", "titulo"]);
  assert.equal(b[0].tipo === "titulo" && b[0].nivel, 2);
  assert.equal(b[1].tipo === "titulo" && b[1].nivel, 3);
});

test("citação junta linhas seguidas", () => {
  const b = blocosDoMarkdown("> uma coisa\n> e outra");
  assert.equal(b[0].tipo, "citacao");
});

test("bloco de código preserva o conteúdo cru", () => {
  const b = blocosDoMarkdown("```\nconst a = **1**;\n```");
  assert.equal(b[0].tipo, "codigo");
  assert.equal(b[0].texto, "const a = **1**;");
});

test("markdown chegando pela metade não explode — é o estado normal do streaming", () => {
  // Metade de tabela, metade de negrito, cerca de código aberta. Explodir aqui
  // apagaria a resposta na cara de quem está lendo ela aparecer.
  const parciais = [
    "| Produto |",
    "| Produto |\n|---|",
    "São **43 de",
    "```\nconst a =",
    "- um\n- ",
    "> ",
    "#",
    "|",
    "`",
  ];
  for (const p of parciais) {
    assert.doesNotThrow(() => blocosDoMarkdown(p), p);
  }
});

test("cada prefixo de uma resposta longa é parseável", () => {
  // O streaming entrega a resposta caractere a caractere. TODO prefixo passa
  // pelo parser, então todo prefixo precisa terminar.
  const completo = [
    "## O que falta",
    "",
    "São **43** produtos sem custo. Destes:",
    "",
    "- 28 já têm peso",
    "- 15 precisam dos dois",
    "",
    "| Produto | Falta |",
    "|---|---|",
    "| Chinelo | peso |",
    "",
    "> Sem custo não há piso.",
  ].join("\n");
  for (let i = 1; i <= completo.length; i++) {
    assert.doesNotThrow(() => blocosDoMarkdown(completo.slice(0, i)), `prefixo ${i}`);
  }
});

test("texto vazio devolve nenhum bloco", () => {
  assert.deepEqual(blocosDoMarkdown(""), []);
  assert.deepEqual(blocosDoMarkdown("   \n\n  "), []);
});

test("a resposta completa vira a estrutura inteira, na ordem", () => {
  const md = [
    "## Resumo",
    "",
    "São **43** sem custo.",
    "",
    "- um",
    "- dois",
    "",
    "| A | B |",
    "|---|---|",
    "| 1 | 2 |",
  ].join("\n");
  assert.deepEqual(tipos(blocosDoMarkdown(md)), [
    "titulo",
    "paragrafo",
    "lista",
    "tabela",
  ]);
});
