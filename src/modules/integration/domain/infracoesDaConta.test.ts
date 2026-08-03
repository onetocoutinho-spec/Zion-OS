// As infrações da conta — e as três formas de a leitura mentir.
//
// A doc do ML avisa que a resposta vem `null` quando não há infração, em vez de
// lista vazia. Isso cria três estados que uma implementação descuidada colapsa
// em um: "não tem infração", "não entendi o que veio" e "não perguntei". Só o
// primeiro autoriza dizer que a conta está limpa.

import test from "node:test";
import assert from "node:assert/strict";
import {
  lerInfracoes,
  contarPorMotivo,
  contaPodeAnunciar,
  referenciaDeModeracao,
} from "./infracoesDaConta.ts";

const inf = (p: Record<string, unknown> = {}) => ({
  id: "INF-1",
  date_created: "2026-07-31",
  user_id: 123,
  related_item_id: "MLB111",
  element_id: "MLB111",
  element_type: "ITM",
  filter_subgroup: "IP",
  reason: "Propriedade intelectual",
  remedy: "Remova a marca do título",
  ...p,
});

// ---------------------------------------------------------------------------
// null NÃO É ERRO — e também não é "está tudo certo" por acidente
// ---------------------------------------------------------------------------

test("corpo null é a resposta documentada para nenhuma infração", () => {
  const r = lerInfracoes(null);
  assert.equal(r.nenhumaDeclarada, true);
  assert.equal(r.formatoInesperado, null);
  assert.equal(r.infracoes.length, 0);
  assert.equal(r.total, 0);
});

test("ausência de corpo NÃO vira nenhuma infração", () => {
  // A diferença entre `null` (o ML disse "nenhuma") e undefined (não chegou
  // nada) é a diferença entre afirmar e não ter olhado.
  const r = lerInfracoes(undefined);
  assert.equal(r.nenhumaDeclarada, false);
  assert.ok(r.formatoInesperado);
});

test("formato inesperado é DECLARADO, não engolido como zero", () => {
  const r = lerInfracoes({ mensagem: "algo novo" });
  assert.equal(r.infracoes.length, 0);
  assert.equal(r.nenhumaDeclarada, false);
  assert.match(r.formatoInesperado ?? "", /mensagem/);
});

// ---------------------------------------------------------------------------
// AS DUAS FORMAS DE EMBRULHO
// ---------------------------------------------------------------------------

test("aceita a lista embrulhada em { infractions, paging }", () => {
  const r = lerInfracoes({ infractions: [inf()], paging: { total: 6, limit: 20, offset: 0 } });
  assert.equal(r.infracoes.length, 1);
  assert.equal(r.total, 6);
  assert.equal(r.infracoes[0].motivo, "Propriedade intelectual");
  assert.equal(r.infracoes[0].remedio, "Remova a marca do título");
});

test("aceita a lista solta", () => {
  const r = lerInfracoes([inf(), inf({ id: "INF-2" })]);
  assert.equal(r.infracoes.length, 2);
});

test("o total do ML NÃO é preenchido com o tamanho da página", () => {
  // Igualar os dois é como a importação afirmava completude nos 500.
  const r = lerInfracoes([inf()]);
  assert.equal(r.total, -1);
  assert.equal(r.infracoes.length, 1);
});

// ---------------------------------------------------------------------------
// CAMPO COM TIPO INESPERADO NÃO DERRUBA A LEITURA
// ---------------------------------------------------------------------------

test("id numérico não estoura — foi assim que family_id derrubou a importação", () => {
  const r = lerInfracoes([inf({ id: 987654, related_item_id: 111 })]);
  assert.equal(r.infracoes[0].id, "987654");
  assert.equal(r.infracoes[0].itemRelacionado, "111");
});

test("campo ausente vira string vazia, nunca 'undefined'", () => {
  const r = lerInfracoes([{ id: "X" }]);
  assert.equal(r.infracoes[0].motivo, "");
  assert.equal(r.infracoes[0].remedio, "");
  assert.equal(r.infracoes[0].tipoElemento, "");
});

// ---------------------------------------------------------------------------
// A CONTAGEM POR MOTIVO
// ---------------------------------------------------------------------------

test("infração sem item relacionado continua sendo contada", () => {
  // Contar pelo tamanho da lista de MLBs faria essa infração sumir do número —
  // e sumir de um número é o defeito mudo que mais custou nesta base.
  const r = contarPorMotivo(
    lerInfracoes([
      inf({ related_item_id: "MLB1" }),
      inf({ related_item_id: "", element_type: "QUE" }),
    ]).infracoes
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].infracoes, 2);
  assert.deepEqual(r[0].itens, ["MLB1"]);
});

test("sem motivo declarado, o rótulo diz que o ML não informou", () => {
  const r = contarPorMotivo(lerInfracoes([inf({ reason: "" })]).infracoes);
  assert.match(r[0].motivo, /não informou/);
});

test("ordena do motivo mais frequente para o menos", () => {
  const r = contarPorMotivo(
    lerInfracoes([
      inf({ reason: "Raro" }),
      inf({ reason: "Comum" }),
      inf({ reason: "Comum" }),
    ]).infracoes
  );
  assert.deepEqual(
    r.map((x) => x.motivo),
    ["Comum", "Raro"]
  );
});

// ---------------------------------------------------------------------------
// A CONTA PODE ANUNCIAR?
// ---------------------------------------------------------------------------

test("list.allow false é o sinal de conta em risco", () => {
  assert.equal(contaPodeAnunciar({ status: { list: { allow: false } } }), false);
  assert.equal(contaPodeAnunciar({ status: { list: { allow: true } } }), true);
});

test("sem list.allow, a resposta é null — nunca 'pode'", () => {
  assert.equal(contaPodeAnunciar({}), null);
  assert.equal(contaPodeAnunciar({ status: {} }), null);
  assert.equal(contaPodeAnunciar(null), null);
  assert.equal(contaPodeAnunciar({ status: { list: { allow: "sim" } } }), null);
});

// ---------------------------------------------------------------------------
// A REFERÊNCIA DE MODERAÇÃO
// ---------------------------------------------------------------------------

test("monta element_id + sufixo do tipo", () => {
  assert.equal(referenciaDeModeracao("MLB123", "ITM"), "MLB123-ITM");
  assert.equal(referenciaDeModeracao("MLB123", "que"), "MLB123-QUE");
});

test("sem tipo, assume ITM — o único tipo que a nossa leitura produz hoje", () => {
  assert.equal(referenciaDeModeracao("MLB123", ""), "MLB123-ITM");
});

test("sem elemento, não monta referência nenhuma", () => {
  assert.equal(referenciaDeModeracao("", "ITM"), "");
});
