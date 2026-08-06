import test from "node:test";
import assert from "node:assert/strict";
import {
  estadoDaMarcaMestre,
  alternarTodos,
  alternarUm,
  resumoDaSelecao,
  corteDaCota,
} from "./selecaoEmLote.ts";

const s = (...ids: string[]) => new Set(ids);

// ---------------------------------------------------------------------------
// A CAIXA MESTRE MEDE O QUE ELA VÊ
// ---------------------------------------------------------------------------

test("lista vazia: a caixa mestre nunca fica cheia", () => {
  assert.equal(estadoDaMarcaMestre([], s()), "nenhum");
  // O filtro não achou nada, mas há marcas de antes. Cheia seria mentira.
  assert.equal(estadoDaMarcaMestre([], s("a", "b")), "nenhum");
});

test("nenhum, parcial e todos", () => {
  assert.equal(estadoDaMarcaMestre(["a", "b", "c"], s()), "nenhum");
  assert.equal(estadoDaMarcaMestre(["a", "b", "c"], s("b")), "parcial");
  assert.equal(estadoDaMarcaMestre(["a", "b", "c"], s("a", "b", "c")), "todos");
});

test("marca fora do filtro não faz a caixa virar 'todos'", () => {
  // A armadilha 1: a tela mostra 'a' e 'b', mas 'z' ficou marcado de antes.
  assert.equal(estadoDaMarcaMestre(["a", "b"], s("a", "b")), "todos");
  assert.equal(estadoDaMarcaMestre(["a", "b"], s("a")), "parcial");
  // 'z' não está na tela: ele não conta para o estado do que está na tela.
  assert.equal(estadoDaMarcaMestre(["a", "b"], s("a", "b", "z")), "todos");
});

// ---------------------------------------------------------------------------
// MARCAR TODOS NÃO DESTRÓI O QUE ESTÁ FORA
// ---------------------------------------------------------------------------

test("marcar todos alcança só os visíveis", () => {
  assert.deepEqual(alternarTodos(["a", "b"], s()), s("a", "b"));
});

test("desmarcar todos PRESERVA a marca que o filtro escondeu", () => {
  // Se isto virar `new Set()`, a caixa mestre passa a apagar escolha às cegas.
  assert.deepEqual(alternarTodos(["a", "b"], s("a", "b", "z")), s("z"));
});

test("com seleção parcial, a caixa mestre COMPLETA em vez de limpar", () => {
  // Meio marcado é ambíguo. Completar é o que a pessoa quis dizer ao clicar.
  assert.deepEqual(alternarTodos(["a", "b", "c"], s("b")), s("a", "b", "c"));
});

test("alternar um vai e volta", () => {
  assert.deepEqual(alternarUm("a", s()), s("a"));
  assert.deepEqual(alternarUm("a", s("a", "b")), s("b"));
});

test("nenhuma função altera o conjunto que recebeu", () => {
  const original = s("a");
  alternarTodos(["a", "b"], original);
  alternarUm("z", original);
  assert.deepEqual(original, s("a"), "o estado do React foi mutado por baixo");
});

// ---------------------------------------------------------------------------
// A BARRA DIZ O QUE ESTÁ FORA DA TELA
// ---------------------------------------------------------------------------

test("sem seleção não há frase", () => {
  assert.deepEqual(resumoDaSelecao(s(), ["a"]), {
    total: 0,
    visiveis: 0,
    ocultos: 0,
    frase: "",
  });
});

test("um produto é dito no singular", () => {
  assert.equal(resumoDaSelecao(s("a"), ["a"]).frase, "1 produto selecionado");
});

test("tudo visível: a frase não inventa ressalva", () => {
  const r = resumoDaSelecao(s("a", "b"), ["a", "b", "c"]);
  assert.equal(r.frase, "2 produtos selecionados");
  assert.equal(r.ocultos, 0);
});

test("o que o filtro escondeu é CONTADO e DITO", () => {
  // A armadilha 2: 12 marcados, 4 fora da tela. Agir sobre os 12 em silêncio
  // faz a conta não bater e ninguém descobre por quê.
  const marcados = s("a", "b", "c", "d");
  const r = resumoDaSelecao(marcados, ["a", "b"]);
  assert.equal(r.total, 4);
  assert.equal(r.visiveis, 2);
  assert.equal(r.ocultos, 2);
  assert.match(r.frase, /2 deles estão fora do filtro atual/);
});

test("um só escondido fala no singular", () => {
  const r = resumoDaSelecao(s("a", "b"), ["a"]);
  assert.match(r.frase, /1 deles está fora do filtro atual/);
});

// ---------------------------------------------------------------------------
// A COTA CORTA ANTES, NÃO DEPOIS
// ---------------------------------------------------------------------------

test("cabendo tudo, não há aviso", () => {
  assert.deepEqual(corteDaCota(10, 100), { entram: 10, ficamDeFora: 0, frase: null });
});

test("cota menor que a escolha: o corte é dito", () => {
  const c = corteDaCota(30, 10);
  assert.equal(c.entram, 10);
  assert.equal(c.ficamDeFora, 20);
  assert.match(c.frase!, /permite 10 agora/);
  assert.match(c.frase!, /os outros 20 ficam/);
});

test("sobrando um só, fala no singular", () => {
  assert.match(corteDaCota(2, 1).frase!, /o outro fica/);
});

test("cota zerada: nenhum entra, e a frase diz isso", () => {
  const c = corteDaCota(5, 0);
  assert.equal(c.entram, 0);
  assert.match(c.frase!, /acabou/);
});

test("cota NEGATIVA é cota zerada, nunca um slice invertido", () => {
  // `slice(0, -3)` devolveria o FIM da lista em vez do começo — a lojista
  // enfileiraria produtos que não escolheu.
  const c = corteDaCota(5, -3);
  assert.equal(c.entram, 0);
  assert.equal(c.ficamDeFora, 5);
  assert.ok(!Number.isNaN(c.entram));
});

test("nada selecionado nunca produz aviso de cota", () => {
  assert.deepEqual(corteDaCota(0, 0), { entram: 0, ficamDeFora: 0, frase: null });
});
