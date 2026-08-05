// Testes da conferência do catálogo em PDF.
//
// O que se prova: o que a lojista desmarcou NÃO é gravado, o número no botão é
// o número que vai ser gravado, e desmarcar por posição não leva junto o
// homônimo — que é o defeito que "desmarcar por nome" teria.
// Rodar: npx tsx --test src/modules/catalog/domain/conferenciaDoCatalogo.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  alternarDescarte,
  linhasParaImportar,
  resumoDaSelecao,
  tamanhoLegivel,
  tokensLegiveis,
} from "./conferenciaDoCatalogo.ts";
import { linhasComOrigem } from "./produtosDoCatalogo.ts";

/** Três produtos, sendo DOIS com o mesmo nome — o caso que separa os desenhos. */
const LIDOS = [
  { nome: "Cama BELLA", paginaOrigem: 12, variacoes: [{ tamanho: "Solteiro" }, { tamanho: "Casal" }] },
  { nome: "LINHA QUARTO", paginaOrigem: 11 }, // um cabeçalho de seção virado produto
  { nome: "Cama BELLA", paginaOrigem: 40 }, // homônimo real, outra página
];

const ITENS = linhasComOrigem(LIDOS);

test("a lista chega inteira, com a página de cada produto", () => {
  assert.equal(ITENS.length, 3);
  assert.deepEqual(
    ITENS.map((i) => i.paginaOrigem),
    [12, 11, 40]
  );
});

// ── O que sai ────────────────────────────────────────────────────────────────

test("sem descarte, tudo é importado", () => {
  const linhas = linhasParaImportar(ITENS, new Set());
  assert.equal(linhas.length, 3);
  assert.equal(resumoDaSelecao(ITENS, new Set()).produtos, 3);
});

test("o descartado NÃO vai para o banco", () => {
  const linhas = linhasParaImportar(ITENS, new Set([1]));
  assert.equal(linhas.length, 2);
  assert.ok(
    !linhas.some((l) => l.base.nome === "LINHA QUARTO"),
    "o cabeçalho de seção foi desmarcado e não pode ser gravado"
  );
});

test("desmarcar por POSIÇÃO não leva junto o homônimo", () => {
  // Este é o teste que justifica o índice como identidade. Duas camas com o
  // mesmo nome e o mesmo SKU gerado: desmarcar por nome tiraria as duas, e a
  // lojista perderia um produto sem nunca ter pedido isso.
  const linhas = linhasParaImportar(ITENS, new Set([0]));
  assert.equal(linhas.length, 2);
  assert.equal(linhas.filter((l) => l.base.nome === "Cama BELLA").length, 1);
});

test("o botão conta o que SOBROU, não o que foi lido", () => {
  const r = resumoDaSelecao(ITENS, new Set([1]));
  assert.equal(r.produtos, 2);
  assert.equal(r.descartados, 1);
  // A Cama BELLA da página 12 tem duas versões; o homônimo da 40 não tem
  // nenhuma. Contar variações do que foi descartado inflaria a promessa.
  assert.equal(r.variacoes, 2);
});

test("descartar tudo dá zero — e zero é o que trava o botão", () => {
  const todos = new Set([0, 1, 2]);
  assert.equal(linhasParaImportar(ITENS, todos).length, 0);
  assert.equal(resumoDaSelecao(ITENS, todos).produtos, 0);
});

test("índice que não existe é ignorado, não derruba a importação", () => {
  const r = resumoDaSelecao(ITENS, new Set([99]));
  assert.equal(r.produtos, 3);
  assert.equal(r.descartados, 0, "um índice fantasma não pode inflar o contador");
  assert.equal(linhasParaImportar(ITENS, new Set([99])).length, 3);
});

// ── Alternar ─────────────────────────────────────────────────────────────────

test("alternar liga e desliga, sem mutar o conjunto anterior", () => {
  const antes: ReadonlySet<number> = new Set([1]);
  const comDois = alternarDescarte(antes, 2);
  assert.deepEqual([...comDois].sort(), [1, 2]);
  assert.deepEqual([...antes], [1], "o estado anterior do React não pode ser mutado");
  assert.deepEqual([...alternarDescarte(comDois, 1)], [2]);
});

// ── Números que a pessoa lê ──────────────────────────────────────────────────

test("o tamanho do arquivo bate com o que o sistema dela mostra", () => {
  assert.equal(tamanhoLegivel(272.6 * 1024 * 1024), "272,6 MB");
  assert.equal(tamanhoLegivel(500 * 1024), "500 KB");
  assert.equal(tamanhoLegivel(0), "0 KB");
  assert.equal(tamanhoLegivel(Number.NaN), "0 KB");
  assert.equal(tamanhoLegivel(-5), "0 KB");
});

test("tokens em milhares, e nunca em reais", () => {
  assert.equal(tokensLegiveis(850), "850");
  assert.equal(tokensLegiveis(1_250_000), "1250 mil");
  assert.equal(tokensLegiveis(0), "0");
  assert.equal(tokensLegiveis(Number.NaN), "0");
});
