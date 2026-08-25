// Testes da ação em massa da fila de aprovações. Puros.
// Rodar: node --test src/app/esteira/aprovacoes/loteDeAprovacao.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import type { AnuncioGeradoRegistro } from "@/lib/types";
import {
  executarLote,
  faixaDaNota,
  fraseDoResultado,
  motivosDaTrava,
  passouATrava,
  planejarLote,
  podeAprovar,
  podeRejeitar,
} from "./loteDeAprovacao";

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

// ---- a trava numa coluna só ----

test("motivosDaTrava: vazio quando passa — e aí a célula diz 'liberado'", () => {
  assert.deepEqual(motivosDaTrava({ vereditoA10: "aprovado", qtdPendencias: 0 }), []);
  assert.equal(passouATrava({ vereditoA10: "aprovado", qtdPendencias: 0 }), true);
});

test("motivosDaTrava: A10 reprovado e pendências são motivos SEPARADOS e somáveis", () => {
  const so10 = motivosDaTrava({ vereditoA10: "reprovado", qtdPendencias: 0 });
  assert.deepEqual(so10.map((m) => m.tipo), ["a10"]);

  const soPend = motivosDaTrava({ vereditoA10: "aprovado", qtdPendencias: 2 });
  assert.deepEqual(soPend.map((m) => m.tipo), ["pendencias"]);

  const ambos = motivosDaTrava({ vereditoA10: "reprovado", qtdPendencias: 3 });
  assert.deepEqual(ambos.map((m) => m.tipo), ["a10", "pendencias"]);
  assert.equal(passouATrava({ vereditoA10: "reprovado", qtdPendencias: 3 }), false);
});

test("o rótulo da pendência concorda em número — '1 pendência', '2 pendências'", () => {
  const [uma] = motivosDaTrava({ vereditoA10: "aprovado", qtdPendencias: 1 });
  assert.equal(uma.rotulo, "1 pendência");
  const [duas] = motivosDaTrava({ vereditoA10: "aprovado", qtdPendencias: 2 });
  assert.equal(duas.rotulo, "2 pendências");
});

test("todo motivo explica o que resolve — o chip tem title, não só rótulo", () => {
  for (const m of motivosDaTrava({ vereditoA10: "reprovado", qtdPendencias: 4 })) {
    assert.ok(m.explica.length > 20, `"${m.tipo}" sem explicação`);
  }
});

test("podeAprovar continua sendo a trava MAIS o status — uma regra, um lugar", () => {
  // Passa na trava mas o status não admite: segue reprovado para aprovação.
  assert.equal(passouATrava({ vereditoA10: "aprovado", qtdPendencias: 0 }), true);
  assert.equal(
    podeAprovar({ vereditoA10: "aprovado", qtdPendencias: 0, status: "publicado" } as never),
    false
  );
  assert.equal(
    podeAprovar({ vereditoA10: "aprovado", qtdPendencias: 0, status: "aguardando_aprovacao" } as never),
    true
  );
});

test("faixaDaNota: os cortes são 75 e 55, e as bordas contam", () => {
  assert.equal(faixaDaNota(100), "boa");
  assert.equal(faixaDaNota(75), "boa");
  assert.equal(faixaDaNota(74), "atenção");
  assert.equal(faixaDaNota(55), "atenção");
  assert.equal(faixaDaNota(54), "ruim");
  assert.equal(faixaDaNota(0), "ruim");
});
