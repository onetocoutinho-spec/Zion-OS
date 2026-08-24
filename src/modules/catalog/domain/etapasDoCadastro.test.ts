// Testes do "o que falta" do cadastro. Puros, sem rede/React.
// Rodar: node --test src/modules/catalog/domain/etapasDoCadastro.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { estaNoAr, oQueFaltaNoCadastro, type EstadoDoCadastro } from "./etapasDoCadastro";

/** Um produto sem nada pendente; cada teste estraga só o que quer medir. */
const PRONTO: EstadoDoCadastro = {
  statusCadastro: "Publicado",
  statusSeo: "Concluído",
  statusDescricao: "Concluído",
  statusImagens: "Concluído",
  statusPrecificacao: "Concluído",
};

const tipos = (p: EstadoDoCadastro) => oQueFaltaNoCadastro(p).map((f) => f.tipo);

test("nada pendente devolve lista vazia — a linha diz que está pronta", () => {
  assert.deepEqual(oQueFaltaNoCadastro(PRONTO), []);
  assert.equal(estaNoAr(PRONTO), true);
});

test("etapa concluída não vira chip — é o que 'concluída' significa", () => {
  assert.deepEqual(tipos({ ...PRONTO, statusSeo: "Concluído" }), []);
});

test("'Pendente' e 'Em andamento' são AMBOS falta — o que muda é emAndamento", () => {
  const naoComecou = oQueFaltaNoCadastro({ ...PRONTO, statusSeo: "Pendente" });
  const comecou = oQueFaltaNoCadastro({ ...PRONTO, statusSeo: "Em andamento" });
  assert.deepEqual(naoComecou.map((f) => f.tipo), ["seo"]);
  assert.deepEqual(comecou.map((f) => f.tipo), ["seo"]);
  assert.equal(naoComecou[0].emAndamento, false);
  assert.equal(comecou[0].emAndamento, true, "quem divide trabalho precisa saber que alguém já pegou");
});

test("a ordem é por quanto destrava, não alfabética", () => {
  const tudoFaltando: EstadoDoCadastro = {
    statusCadastro: "Não iniciado",
    statusSeo: "Pendente",
    statusDescricao: "Pendente",
    statusImagens: "Pendente",
    statusPrecificacao: "Pendente",
  };
  assert.deepEqual(tipos(tudoFaltando), ["cadastro", "preco", "imagens", "descricao", "seo"]);
});

test("'Publicado' e 'Em cadastro' NÃO são falta; 'Com erro' e 'Não iniciado' são", () => {
  assert.deepEqual(tipos({ ...PRONTO, statusCadastro: "Publicado" }), []);
  assert.deepEqual(tipos({ ...PRONTO, statusCadastro: "Em cadastro" }), []);
  assert.deepEqual(tipos({ ...PRONTO, statusCadastro: "Não iniciado" }), ["cadastro"]);
  assert.deepEqual(tipos({ ...PRONTO, statusCadastro: "Com erro" }), ["cadastro"]);
});

test("'Com erro' é defeito, não falta — vem marcado para a tela pintar diferente", () => {
  const [f] = oQueFaltaNoCadastro({ ...PRONTO, statusCadastro: "Com erro" });
  assert.equal(f.comErro, true);
  assert.match(f.rotulo, /erro/);
  const [naoIniciado] = oQueFaltaNoCadastro({ ...PRONTO, statusCadastro: "Não iniciado" });
  assert.notEqual(naoIniciado.comErro, true);
});

test("toda falta explica o que impede — o chip tem title, não só rótulo", () => {
  const todas = oQueFaltaNoCadastro({
    statusCadastro: "Com erro",
    statusSeo: "Pendente",
    statusDescricao: "Pendente",
    statusImagens: "Pendente",
    statusPrecificacao: "Pendente",
  });
  assert.equal(todas.length, 5);
  for (const f of todas) {
    assert.ok(f.impede.length > 20, `"${f.tipo}" sem explicação do que impede`);
    assert.ok(f.rotulo.length > 0);
  }
});

test("estaNoAr distingue 'publicado e pronto' de 'sem faltas, mas não publicado'", () => {
  // "Em cadastro" com tudo concluído não tem falta nenhuma — mas não está no ar.
  const semFaltas: EstadoDoCadastro = { ...PRONTO, statusCadastro: "Em cadastro" };
  assert.deepEqual(oQueFaltaNoCadastro(semFaltas), []);
  assert.equal(estaNoAr(semFaltas), false, "sem falta não é o mesmo que publicado");
  assert.equal(estaNoAr(PRONTO), true);
});
