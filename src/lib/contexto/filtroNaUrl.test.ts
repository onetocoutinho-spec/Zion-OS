// Testes da regra do filtro na URL. Puros, sem rede/React.
// Rodar: node --test src/lib/contexto/filtroNaUrl.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFiltro, queryComFiltro } from "./filtroNaUrl";

const params = (s: string) => new URLSearchParams(s);

test("lerFiltro: ausente ou vazio cai no padrão", () => {
  assert.equal(lerFiltro(params(""), "cadastro", "Todos"), "Todos");
  assert.equal(lerFiltro(params("cadastro="), "cadastro", "Todos"), "Todos");
});

test("lerFiltro: valor presente é devolvido", () => {
  assert.equal(lerFiltro(params("cadastro=Pendente"), "cadastro", "Todos"), "Pendente");
});

test("lerFiltro: valor fora das opções cai no padrão, sem quebrar a tela", () => {
  assert.equal(lerFiltro(params("cadastro=xyz"), "cadastro", "Todos", ["Todos", "Pendente"]), "Todos");
  assert.equal(lerFiltro(params("cadastro=Pendente"), "cadastro", "Todos", ["Todos", "Pendente"]), "Pendente");
});

test("queryComFiltro: o padrão NÃO aparece na URL", () => {
  assert.equal(queryComFiltro("", "cadastro", "Todos", "Todos"), "");
  assert.equal(queryComFiltro("?cadastro=Pendente", "cadastro", "Todos", "Todos"), "");
});

test("queryComFiltro: grava e troca o valor", () => {
  assert.equal(queryComFiltro("", "cadastro", "Pendente", "Todos"), "?cadastro=Pendente");
  assert.equal(queryComFiltro("?cadastro=Pendente", "cadastro", "Em andamento", "Todos"), "?cadastro=Em+andamento");
});

test("queryComFiltro: preserva ?loja= e os outros filtros — são de outros donos", () => {
  assert.equal(
    queryComFiltro("?loja=cli-05&prioridade=Alta", "cadastro", "Pendente", "Todos"),
    "?loja=cli-05&prioridade=Alta&cadastro=Pendente"
  );
  assert.equal(queryComFiltro("?loja=cli-05&cadastro=Pendente", "cadastro", "Todos", "Todos"), "?loja=cli-05");
});

test("queryComFiltro: aceita query com ou sem '?'", () => {
  assert.equal(queryComFiltro("loja=x", "p", "A", "Todos"), "?loja=x&p=A");
  assert.equal(queryComFiltro("?loja=x", "p", "A", "Todos"), "?loja=x&p=A");
});
