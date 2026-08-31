import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// RECOMPOR O VEREDITO NÃO DESFAZ UMA PUBLICAÇÃO QUE ACONTECEU.
//
// ===========================================================================
// O CASO, EM 31/08/2026 — e a lojista viu antes de mim
// ===========================================================================
//
// `recomporVeredictos.mjs` gravava:
//
//     const status = passou ? "aguardando_aprovacao" : "rascunho";
//
// sem olhar se o anúncio JÁ ESTAVA NO AR. Rodado numa base com 792 publicados,
// rebaixou 791 deles para `aguardando_aprovacao`.
//
// A tela de Anúncios conta publicados como `status === "publicado" && mlItemId`.
// Resultado: a lojista abriu o portal e viu ZERO anúncios cadastrados, numa
// loja com 792 no Mercado Livre.
//
// O script tinha rodado meia hora antes, com 877 gravações e "0 falhas". A
// escrita foi perfeita; o valor escrito é que estava errado.
//
// ===========================================================================
// A REGRA, E POR QUE ELA É DO DOMÍNIO E NÃO DO SCRIPT
// ===========================================================================
//
// `ml_item_id` só existe porque alguém PUBLICOU. É um fato do passado, e fato
// do passado não se recalcula.
//
// O estado ATUAL no marketplace — ativo, pausado, fechado — mora em
// `status_marketplace`, que é outra coluna e tem outro dono (o próprio ML).
// `status` conta a jornada dentro do Zion, e publicar é o fim dela.
//
// Confundir as duas é o que produziu o defeito: um anúncio `closed` no ML
// continua tendo sido publicado, e a tela sabe mostrar as duas coisas lado a
// lado — desde que ninguém apague uma com a outra.
//
// ===========================================================================
// POR QUE SENTINELA DE FONTE
// ===========================================================================
//
// O script é `.mjs`, roda contra o banco e não tem função pura a testar. O que
// se protege não é um resultado: é a AUSÊNCIA da linha que rebaixa. Uma
// regressão aqui não daria erro — daria "877 gravados, 0 falhas" e uma loja
// que parece vazia.

const FONTE = readFileSync(new URL("../../../../scripts/recomporVeredictos.mjs", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/\s+/g, " ");

test("o recompor NÃO rebaixa anúncio que já está no ar", () => {
  assert.ok(
    !/const status = passou \? "aguardando_aprovacao" : "rascunho";/.test(CODIGO),
    "voltou o status calculado sem olhar `ml_item_id` — isso rebaixou 791 anúncios " +
      "publicados em 31/08/2026, e a tela da lojista passou a mostrar zero"
  );
  assert.match(
    CODIGO,
    /a\.ml_item_id \? a\.status :/,
    "o cálculo do status parou de preservar o que já foi publicado"
  );
});

test("o script LÊ `ml_item_id` — sem isso a guarda seria sempre falsa", () => {
  // A guarda depende de um campo que precisa estar no `select`. Se ele sair,
  // `a.ml_item_id` vira `undefined`, o ternário cai sempre no ramo do cálculo,
  // e o defeito volta inteiro — com a linha de proteção ainda no lugar, o que
  // é pior que sem ela.
  assert.match(
    CODIGO,
    /"id, produto_id, veredito_a10, qtd_pendencias, status, ml_item_id, anuncio"/,
    "`ml_item_id` saiu do select de `anuncios_gerados`; a guarda do status fica cega"
  );
});
