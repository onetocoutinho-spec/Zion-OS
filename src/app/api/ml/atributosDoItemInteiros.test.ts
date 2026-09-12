// O diagnóstico devolve os atributos do ITEM inteiros — sem filtrar por palpite.
//
// ===========================================================================
// O CASO, 20/08/2026 — o defeito repetido DENTRO do próprio conserto
// ===========================================================================
//
// Em 18/08/2026 esta rota afirmou três vezes que um SKU não existia no ML.
// Existia; eu lia o campo errado. O conserto foi devolver os atributos da
// VARIAÇÃO inteiros, com um comentário que diz, literalmente, "eu não filtro
// mais por palpite sobre qual campo importa".
//
// Duas dezenas de linhas abaixo, no nível do ITEM, o filtro continuava:
//
//   .filter((a) => a.id === "SELLER_SKU" || a.id === "GTIN")
//
// A conta veio no Papete Modare. A lojista notou que o produto "parece não
// estar vinculado, pois tem algumas variações separadas das outras lá no
// Mercado Livre" — e estava certa: 17 anúncios rachados em QUATRO famílias.
//
// Nesta conta cada TAMANHO é um item separado (modelo User Products, ver
// `mlUserProducts.ts`), então o anúncio NÃO TEM variações — e é justamente aí
// que o filtro do nível do item morde. `SIZE_GRID_ID` e `SIZE_GRID_ROW_ID`,
// que são o que o ML usa para agrupar a família, moram no nível do item e eram
// descartados na borda. Perguntar "por que o Bege 36 está sozinho" não tinha
// resposta possível com o que a rota devolvia.
//
// O formato deste repositório: o dado chega, o leitor não alcança, e o software
// afirma ausência com confiança. Esta sentinela guarda a outra metade do
// conserto de 18/08 — a que eu tinha esquecido.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./diagnostico-item/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("os atributos do ITEM não voltam a ser filtrados por id", () => {
  const trecho = CODIGO.slice(
    CODIGO.indexOf("atributosDoItem"),
    CODIGO.indexOf("video_id")
  );
  assert.ok(trecho.length > 0, "sumiu `atributosDoItem` da resposta");
  assert.ok(
    !/\.filter\(/.test(trecho),
    "voltou o filtro no nível do item — SIZE_GRID_ID e o resto morrem na borda de novo"
  );
});

// A prova positiva: o mesmo formato `id=valor` da variação, com TODOS os ids.
test("o item usa o mesmo formato da variação, com o id de cada atributo", () => {
  assert.match(
    CODIGO,
    /atributosDoItem:[\s\S]{0,400}\.map\(\(a\) => `\$\{a\.id \?\? "\?"\}=/,
    "o item parou de nomear o id de cada atributo — não dá para achar SIZE_GRID_ID"
  );
});

// `value_id` importa: atributos de lista fechada (COLOR, GENDER) costumam vir
// só com o id. Mostrar apenas `value_name` devolveria vazio justamente nos que
// decidem em qual família o ML põe o anúncio.
test("quando não há value_name, o value_id aparece no lugar", () => {
  assert.match(
    CODIGO,
    /a\.value_name \?\? a\.value_id \?\? ""/,
    "atributo de lista fechada voltou a aparecer vazio"
  );
});
