// Duas linhas com o MESMO nome e custos diferentes não podem gravar nenhuma.
//
// ===========================================================================
// COMO ISTO FOI DESCOBERTO
// ===========================================================================
//
// 10/08/2026, forjando uma planilha suja de propósito para ver os caminhos
// tristes na tela. Duas linhas de "Babuche Molekinha Arco Iris 22591.408", uma
// com 54,16 e outra com 61,90.
//
// O relatório disse "Gravei o custo em 2 produto(s)" e ZERO ambíguos. No banco,
// o produto tinha ido de 54,16 para 61,90 — o segundo valor venceu, calado. Foi
// preciso restaurar o dado à mão.
//
// ===========================================================================
// A CAUSA
// ===========================================================================
//
//     porNomeExato.set(normNome(nome), custo)   // um Map<string, number>
//
// O segundo `set` sobrescrevia o primeiro. E `custoPorNome` consultava esse
// mapa ANTES da detecção de ambiguidade — que só rodava no caminho APROXIMADO,
// com `mesmaIdentidade`.
//
// Ou seja: a guarda de conflito, que o arquivo documenta com cuidado, nunca
// valeu para nomes IDÊNTICOS. E nome repetido é a forma mais comum de planilha
// suja: o mesmo produto listado duas vezes, com o preço velho e o novo.
//
// O caminho aproximado estava certo desde sempre; o exato passava na frente
// dele e decidia sozinho.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./importacaoCustos.ts", import.meta.url), "utf8").replace(
  /\r\n/g,
  "\n"
);

test("o mapa de nome exato guarda TODOS os custos, não o último", () => {
  // `Map<string, number>` é a forma que perde. A que preserva carrega a lista.
  assert.doesNotMatch(
    FONTE,
    /const porNomeExato = new Map<string, number>\(\)/,
    "`porNomeExato` voltou a ser Map<string, number>: o segundo custo sobrescreve o primeiro em silêncio"
  );
  assert.match(
    FONTE,
    /const porNomeExato = new Map<string,\s*\{ custo: number; original: string \}\[\]>/,
    "`porNomeExato` deixou de guardar a lista de candidatos"
  );
});

test("o caminho EXATO também registra ambiguidade", () => {
  // Antes só o caminho aproximado chamava `ambiguos.set`. Se voltar a haver um
  // único `ambiguos.set` no arquivo, o exato parou de recusar.
  const registros = FONTE.match(/ambiguos\.set\(/g) ?? [];
  assert.ok(
    registros.length >= 2,
    `só ${registros.length} registro(s) de ambiguidade — o caminho exato voltou a decidir sozinho`
  );
});

test("o exato NÃO retorna custo antes de conferir se há mais de um", () => {
  // A linha `if (exato != null) return exato;` era o defeito inteiro: saída
  // antecipada com o último valor, sem olhar para os outros.
  assert.doesNotMatch(
    FONTE,
    /const exato = porNomeExato\.get\([^)]*\);\s*\n\s*if \(exato != null\) return exato;/,
    "voltou a devolver o custo exato sem conferir conflito"
  );
  assert.match(
    FONTE,
    /if \(distintos\.length > 1\) \{/,
    "a conferência de custos distintos sumiu do caminho exato"
  );
});

test("o motivo está escrito no código, com o número medido", () => {
  // Sem o caso, a próxima pessoa "simplifica" isto de volta para um Map.
  assert.match(FONTE, /54,16 e 61,90/, "o caso medido saiu do comentário");
});
