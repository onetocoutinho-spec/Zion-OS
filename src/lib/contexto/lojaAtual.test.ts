// Testes da resolução da loja atual. Puros, sem rede/React.
// Rodar: node --test src/lib/contexto/lojaAtual.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cookieDaLoja,
  lerCookieDaLoja,
  lojaDoSegmento,
  queryComLoja,
  resolverLojaAtual,
  type EntradaDaResolucao,
} from "./lojaAtual.ts";

const LOJAS = [{ id: "A" }, { id: "B" }];

function entrada(parcial: Partial<EntradaDaResolucao>): EntradaDaResolucao {
  return {
    pathname: "/produtos",
    lojaDaQuery: null,
    lojaDoCookie: null,
    perfil: { papel: "agencia", clienteId: null },
    lojasAlcancaveis: LOJAS,
    ...parcial,
  };
}

// ---- lojaDoSegmento ----

test("lojaDoSegmento: /lojas/<id> e subrotas", () => {
  assert.equal(lojaDoSegmento("/lojas/A"), "A");
  assert.equal(lojaDoSegmento("/lojas/A/catalogo/produtos"), "A");
  assert.equal(lojaDoSegmento("/lojas/A?x=1"), "A");
});

test("lojaDoSegmento: /lojas (lista), /lojas/novo e outras rotas não são loja", () => {
  assert.equal(lojaDoSegmento("/lojas"), null);
  assert.equal(lojaDoSegmento("/lojas/novo"), null);
  assert.equal(lojaDoSegmento("/clientes/A"), null);
  assert.equal(lojaDoSegmento("/"), null);
});

// ---- precedência ----

test("o lojista É a loja: perfil vence URL, query e cookie", () => {
  const r = resolverLojaAtual(
    entrada({
      perfil: { papel: "cliente", clienteId: "C" },
      pathname: "/lojas/A",
      lojaDaQuery: "B",
      lojaDoCookie: "B",
    })
  );
  assert.deepEqual(r, { lojaId: "C", origem: "perfil" });
});

test("segmento de URL vence query e cookie", () => {
  const r = resolverLojaAtual(entrada({ pathname: "/lojas/A", lojaDaQuery: "B", lojaDoCookie: "B" }));
  assert.deepEqual(r, { lojaId: "A", origem: "url" });
});

test("segmento de URL para loja sem acesso NÃO cai noutra loja (a tela mostra o 403)", () => {
  const r = resolverLojaAtual(entrada({ pathname: "/lojas/Z", lojaDoCookie: "A" }));
  assert.deepEqual(r, { lojaId: "Z", origem: "url" });
});

test("query vence cookie", () => {
  const r = resolverLojaAtual(entrada({ lojaDaQuery: "A", lojaDoCookie: "B" }));
  assert.deepEqual(r, { lojaId: "A", origem: "query" });
});

test("cookie quando não há nada na URL", () => {
  const r = resolverLojaAtual(entrada({ lojaDoCookie: "B" }));
  assert.deepEqual(r, { lojaId: "B", origem: "cookie" });
});

test("sem nada → portfólio; NUNCA a primeira loja da lista", () => {
  const r = resolverLojaAtual(entrada({}));
  assert.deepEqual(r, { lojaId: null, origem: "nenhuma" });
});

test("cookie/query apontando para loja que o usuário não alcança são ignorados", () => {
  assert.deepEqual(resolverLojaAtual(entrada({ lojaDoCookie: "Z" })), { lojaId: null, origem: "nenhuma" });
  assert.deepEqual(resolverLojaAtual(entrada({ lojaDaQuery: "Z", lojaDoCookie: "A" })), {
    lojaId: "A",
    origem: "cookie",
  });
});

test("enquanto a lista de lojas não chegou, cookie e query são aceitos provisoriamente", () => {
  const r = resolverLojaAtual(entrada({ lojaDoCookie: "Z", lojasAlcancaveis: null }));
  assert.deepEqual(r, { lojaId: "Z", origem: "cookie" });
});

test("equipe segue a mesma regra da agência", () => {
  const r = resolverLojaAtual(entrada({ perfil: { papel: "equipe", clienteId: null }, lojaDaQuery: "A" }));
  assert.deepEqual(r, { lojaId: "A", origem: "query" });
});

test("sem perfil (ainda carregando) a URL e o cookie continuam valendo", () => {
  const r = resolverLojaAtual(entrada({ perfil: null, lojaDoCookie: "A" }));
  assert.deepEqual(r, { lojaId: "A", origem: "cookie" });
});

// ---- cookie ----

test("lerCookieDaLoja lê só zion.loja, com decode", () => {
  assert.equal(lerCookieDaLoja("a=1; zion.loja=A%20B; b=2"), "A B");
  assert.equal(lerCookieDaLoja("a=1; b=2"), null);
  assert.equal(lerCookieDaLoja("zion.loja="), null);
  assert.equal(lerCookieDaLoja(""), null);
});

test("cookieDaLoja grava por 30 dias e apaga com Max-Age=0", () => {
  assert.match(cookieDaLoja("A"), /^zion\.loja=A; Path=\/; Max-Age=2592000; SameSite=Lax$/);
  assert.match(cookieDaLoja(null), /^zion\.loja=; Path=\/; Max-Age=0; SameSite=Lax$/);
});

// ---- query ----

test("queryComLoja preserva os outros parâmetros", () => {
  assert.equal(queryComLoja("?q=x", "A"), "?q=x&loja=A");
  assert.equal(queryComLoja("?loja=B&q=x", "A"), "?loja=A&q=x");
  assert.equal(queryComLoja("?loja=B&q=x", null), "?q=x");
  assert.equal(queryComLoja("?loja=B", null), "");
  assert.equal(queryComLoja("", "A"), "?loja=A");
});
