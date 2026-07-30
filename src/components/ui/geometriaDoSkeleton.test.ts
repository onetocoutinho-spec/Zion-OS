import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deveAnimar,
  larguraDaLinha,
  largurasDaLinhaDaTabela,
  linhasParaMostrar,
} from "./geometriaDoSkeleton.ts";

test("larguraDaLinha: é DETERMINÍSTICA — a mesma no servidor e no cliente", () => {
  // Se isto virar Math.random(), a hidratação divergе e o React remonta a tela:
  // o esqueleto passa a causar o pulo que existe para evitar.
  for (let i = 0; i < 12; i++) {
    assert.equal(larguraDaLinha(i, 12), larguraDaLinha(i, 12));
  }
});

test("larguraDaLinha: a última linha é curta — é o que diz 'aqui acaba'", () => {
  assert.equal(larguraDaLinha(4, 5), 62);
  assert.ok(larguraDaLinha(4, 5) < larguraDaLinha(0, 5));
});

test("larguraDaLinha: linha sozinha NÃO é curta", () => {
  // 62% sozinho parece um campo de formulário, não um texto.
  assert.notEqual(larguraDaLinha(0, 1), 62);
});

test("larguraDaLinha: as larguras variam — não é um retângulo", () => {
  const larguras = new Set([0, 1, 2, 3].map((i) => larguraDaLinha(i, 8)));
  assert.ok(larguras.size > 1, "todas as linhas com a mesma largura viram um bloco");
});

test("larguraDaLinha: nunca passa de 100% nem fica negativa", () => {
  for (let total = 1; total <= 10; total++) {
    for (let i = 0; i < total; i++) {
      const l = larguraDaLinha(i, total);
      assert.ok(l > 0 && l <= 100, `largura fora da faixa: ${l}`);
    }
  }
});

test("larguraDaLinha: total zero não gera largura", () => {
  assert.equal(larguraDaLinha(0, 0), 0);
});

test("largurasDaLinhaDaTabela: a primeira coluna é a mais larga (a identidade)", () => {
  const l = largurasDaLinhaDaTabela(4);
  assert.equal(l.length, 4);
  assert.ok(l[0] > l[1], "a coluna de identidade tem que dominar");
});

test("largurasDaLinhaDaTabela: as colunas somam 100%", () => {
  for (const n of [1, 2, 3, 5, 8]) {
    const soma = largurasDaLinhaDaTabela(n).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(soma - 100) < 0.0001, `${n} colunas somaram ${soma}`);
  }
});

test("largurasDaLinhaDaTabela: coluna única ocupa tudo", () => {
  assert.deepEqual(largurasDaLinhaDaTabela(1), [100]);
});

test("largurasDaLinhaDaTabela: zero colunas não gera nada", () => {
  assert.deepEqual(largurasDaLinhaDaTabela(0), []);
});

test("largurasDaLinhaDaTabela: as colunas de estado ficam iguais entre si", () => {
  const [, ...resto] = largurasDaLinhaDaTabela(5);
  assert.equal(new Set(resto).size, 1);
});

test("linhasParaMostrar: sem total conhecido usa o padrão", () => {
  assert.equal(linhasParaMostrar(), 5);
});

test("linhasParaMostrar: com total conhecido preserva o tamanho da tela", () => {
  // Revalidando uma tabela que tinha 3 linhas: o esqueleto tem 3, e a página
  // não muda de altura quando o dado chega.
  assert.equal(linhasParaMostrar(3), 3);
});

test("linhasParaMostrar: teto de 8 — esqueleto longo parece conteúdo", () => {
  assert.equal(linhasParaMostrar(500), 8);
  assert.equal(linhasParaMostrar(9), 8);
});

test("linhasParaMostrar: total zero ainda desenha uma linha", () => {
  // Zero linhas de esqueleto é uma tela em branco — indistinguível de vazio,
  // que é o defeito que esta vertical corrige.
  assert.equal(linhasParaMostrar(0), 1);
  assert.equal(linhasParaMostrar(-3), 1);
});

test("deveAnimar: respeita quem pediu menos movimento", () => {
  assert.equal(deveAnimar(true), false);
  assert.equal(deveAnimar(false), true);
});
