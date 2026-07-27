// Testes da retomada da jornada.
//
// O defeito relatado pelo lojista: sair da tela de criar anúncio e voltar
// fazia tudo recomeçar do zero, mesmo com o anúncio já gerado. A etapa sempre
// se recuperou sozinha (deriva dos dados); o que se perdia era QUAL produto.
// Rodar: npx tsx --test src/modules/publication/domain/retomada.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { produtoParaRetomar, chaveUltimoProduto } from "./retomada.ts";

const disponiveis = ["p1", "p2", "p3"];

test("sem nada, abre limpo", () => {
  assert.equal(produtoParaRetomar({ disponiveis }), null);
});

test("retoma o último produto tratado", () => {
  assert.equal(produtoParaRetomar({ ultimoUsado: "p2", disponiveis }), "p2");
});

test("a URL vence a memória — quem chegou por link pediu AQUELE produto", () => {
  assert.equal(produtoParaRetomar({ daUrl: "p3", ultimoUsado: "p1", disponiveis }), "p3");
});

test("URL com produto inexistente NÃO cai no último usado", () => {
  // Trocar a intenção da pessoa por outra coisa é pior que abrir limpo.
  assert.equal(produtoParaRetomar({ daUrl: "sumiu", ultimoUsado: "p1", disponiveis }), null);
});

test("último usado que não existe mais é ignorado", () => {
  // Produto apagado, ou de outro cliente: retomar nele mostraria uma jornada
  // sobre coisa nenhuma.
  assert.equal(produtoParaRetomar({ ultimoUsado: "apagado", disponiveis }), null);
});

test("lista vazia não retoma nada", () => {
  assert.equal(produtoParaRetomar({ daUrl: "p1", ultimoUsado: "p2", disponiveis: [] }), null);
});

test("espaços e vazios não viram id", () => {
  assert.equal(produtoParaRetomar({ daUrl: "  ", ultimoUsado: "p1", disponiveis }), "p1");
  assert.equal(produtoParaRetomar({ daUrl: " p3 ", disponiveis }), "p3");
  assert.equal(produtoParaRetomar({ ultimoUsado: "", disponiveis }), null);
});

test("a chave de storage separa clientes no mesmo navegador", () => {
  assert.notEqual(chaveUltimoProduto("cli-a"), chaveUltimoProduto("cli-b"));
  assert.match(chaveUltimoProduto("cli-a"), /cli-a/);
  // sem cliente ainda produz chave estável, sem colidir com um cliente real
  assert.equal(chaveUltimoProduto(""), "zion:jornada:ultimoProduto:sem-cliente");
});
