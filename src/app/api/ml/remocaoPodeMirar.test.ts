// A remoção de foto precisa poder mirar em anúncios específicos.
//
// ===========================================================================
// O CASO, 20/08/2026
// ===========================================================================
//
// Uma foto no Mercado Livre tem UM id — e o mesmo id pode estar CERTO num
// anúncio e ERRADO em outro do mesmo produto.
//
// Medido no Papete Modare: `604761-MLB116507673175_082026` é a foto da Avelã,
// que é marrom. Ela era:
//
//   • a CAPA CORRETA dos anúncios Avelã 34, 36 e 40;
//   • uma foto INTRUSA dentro dos anúncios Alecrim 35, 37 e 38, que são
//     verde-oliva — porque a cor deles fora deduzida do título, e o título
//     diz "Marrom" (a lista COLOR do ML não tem Alecrim).
//
// `remover-foto` varria todos os anúncios do produto. Chamada assim, ela
// consertaria os três verdes e ARRANCARIA A CAPA dos três marrons — trocando
// um erro por outro, sem ninguém pedir.
//
// O recorte é OPCIONAL: sem ele, o comportamento de antes continua.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const FONTE = readFileSync(new URL("./remover-foto/route.ts", import.meta.url), "utf8");
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("a rota aceita um recorte de anúncios", () => {
  assert.match(CODIGO, /mlbs\?: string\[\];/, "sumiu o recorte — a remoção volta a ser tudo-ou-nada");
  assert.match(
    CODIGO,
    /const recorte = new Set\(/,
    "o recorte deixou de ser montado"
  );
});

// Sem esta linha o recorte vazio viraria "nenhum anúncio", e toda chamada
// antiga — que não manda `mlbs` — passaria a não fazer nada, calada.
test("sem recorte, continua valendo para todos os anúncios do produto", () => {
  assert.match(
    CODIGO,
    /recorte\.size === 0 \|\| recorte\.has\(/,
    "recorte vazio parou de significar 'todos' — as chamadas antigas viram no-op silencioso"
  );
});

// O ML devolve os ids em maiúsculas e quem chama pode digitar de qualquer
// jeito; casar por texto cru faria o recorte falhar em silêncio, que é o
// mesmo no-op de cima com outra roupa.
test("o recorte casa sem depender de maiúsculas", () => {
  assert.match(
    CODIGO,
    /\.toUpperCase\(\)\)\.filter\(Boolean\)/,
    "o recorte voltou a casar por texto cru"
  );
  assert.match(
    CODIGO,
    /recorte\.has\(String\(a\.mlb\)\.toUpperCase\(\)\)/,
    "o lado do anúncio deixou de ser normalizado"
  );
});
