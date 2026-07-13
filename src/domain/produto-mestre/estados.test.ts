// Testes da máquina de estados — puros.
import { test } from "node:test";
import assert from "node:assert/strict";
import { podeTransicionar } from "./estados.ts";

test("caminho feliz do ciclo de vida é permitido", () => {
  assert.equal(podeTransicionar("rascunho", "enriquecido"), true);
  assert.equal(podeTransicionar("enriquecido", "pendente_aprovacao"), true);
  assert.equal(podeTransicionar("pendente_aprovacao", "aprovado"), true);
  assert.equal(podeTransicionar("aprovado", "publicado"), true);
  assert.equal(podeTransicionar("publicado", "pausado"), true);
  assert.equal(podeTransicionar("pausado", "publicado"), true);
});

test("saltos inválidos são barrados", () => {
  assert.equal(podeTransicionar("rascunho", "publicado"), false);
  assert.equal(podeTransicionar("rascunho", "aprovado"), false);
  assert.equal(podeTransicionar("arquivado", "publicado"), false);
});

test("edição de aprovado permite voltar a pendente_aprovacao (F4)", () => {
  assert.equal(podeTransicionar("aprovado", "pendente_aprovacao"), true);
});

test("arquivar é permitido a partir dos estados operacionais", () => {
  assert.equal(podeTransicionar("aprovado", "arquivado"), true);
  assert.equal(podeTransicionar("publicado", "arquivado"), true);
  assert.equal(podeTransicionar("rascunho", "arquivado"), true);
});
