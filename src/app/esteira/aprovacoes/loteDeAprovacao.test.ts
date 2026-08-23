// Testes da ação em massa da fila de aprovações. Puros.
// Rodar: node --test src/app/esteira/aprovacoes/loteDeAprovacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { AnuncioGeradoRegistro } from "@/lib/types";
import { executarLote, fraseDoResultado, planejarLote, podeAprovar, podeRejeitar } from "./loteDeAprovacao";

function reg(
  id: string,
  status: AnuncioGeradoRegistro["status"],
  vereditoA10: AnuncioGeradoRegistro["vereditoA10"] = "aprovado",
  qtdPendencias = 0
): AnuncioGeradoRegistro {
  return { id, status, vereditoA10, qtdPendencias } as AnuncioGeradoRegistro;
}

test("podeAprovar: só A10 aprovado, zero pendências e status que admite", () => {
  assert.equal(podeAprovar(reg("a", "aguardando_aprovacao")), true);
  assert.equal(podeAprovar(reg("a", "rascunho")), true);
  assert.equal(podeAprovar(reg("a", "aguardando_aprovacao", "reprovado")), false);
  assert.equal(podeAprovar(reg("a", "aguardando_aprovacao", "aprovado", 2)), false);
  assert.equal(podeAprovar(reg("a", "aprovado")), false);
  assert.equal(podeAprovar(reg("a", "publicado")), false);
});

test("podeRejeitar: tudo menos já rejeitado ou publicado", () => {
  assert.equal(podeRejeitar(reg("a", "rascunho")), true);
  assert.equal(podeRejeitar(reg("a", "aprovado")), true);
  assert.equal(podeRejeitar(reg("a", "rejeitado")), false);
  assert.equal(podeRejeitar(reg("a", "publicado")), false);
});

test("planejarLote: a trava da linha vale no lote — quem não passa é pulado, não aprovado", () => {
  const registros = [
    reg("1", "aguardando_aprovacao"),
    reg("2", "aguardando_aprovacao", "reprovado"),
    reg("3", "rascunho"),
    reg("4", "publicado"),
  ];
  const plano = planejarLote("aprovar", new Set(["1", "2", "3", "4"]), registros);
  assert.deepEqual(plano.entram, ["1", "3"]);
  assert.equal(plano.pulados, 2);
});

test("planejarLote: só os marcados entram, na ordem da lista", () => {
  const registros = [reg("b", "rascunho"), reg("a", "rascunho"), reg("c", "rascunho")];
  const plano = planejarLote("rejeitar", new Set(["c", "a"]), registros);
  assert.deepEqual(plano.entram, ["a", "c"]);
  assert.equal(plano.pulados, 0);
});

test("executarLote: uma falha não interrompe as seguintes", async () => {
  const chamados: string[] = [];
  const r = await executarLote({ entram: ["1", "2", "3"], pulados: 1 }, async (id) => {
    chamados.push(id);
    if (id === "2") throw new Error("RLS");
  });
  assert.deepEqual(chamados, ["1", "2", "3"]);
  assert.deepEqual(r, { feitos: 2, feitosIds: ["1", "3"], falhas: 1, pulados: 1 });
});

test("fraseDoResultado: não esconde falha nem pulo", () => {
  assert.equal(fraseDoResultado("aprovar", { feitos: 3, feitosIds: ["a", "b", "c"], falhas: 0, pulados: 0 }), "3 aprovados.");
  assert.equal(fraseDoResultado("aprovar", { feitos: 1, feitosIds: ["a"], falhas: 1, pulados: 2 }), "1 aprovado · 1 falhou · 2 pulados pela trava.");
  assert.equal(fraseDoResultado("rejeitar", { feitos: 0, feitosIds: [], falhas: 2, pulados: 1 }), "0 rejeitados · 2 falharam · 1 pulado pela trava.");
});
