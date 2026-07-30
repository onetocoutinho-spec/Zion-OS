import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comoEvento,
  ofertasQueValem,
  rotuloDoDesbloqueio,
  semDesbloqueios,
  type Consequencia,
} from "./consequencia.ts";
import { ESTADO_INICIAL, aplicar, type EstadoDoWorkspace } from "./modosDoWorkspace.ts";

test("semDesbloqueios: o caso comum de hoje não oferece transição nenhuma", () => {
  const c = semDesbloqueios("47 variantes atualizadas", 47);
  assert.equal(c.afetados, 47);
  assert.deepEqual(c.desbloqueios, []);
  assert.deepEqual(comoEvento(c).consequencia.desbloqueou, []);
});

test("a consequência convertida em evento NÃO leva destino", () => {
  const c: Consequencia = {
    resumo: "47 variantes atualizadas",
    afetados: 47,
    desbloqueios: [{ modo: "pricing", quantos: null }],
  };
  const e = comoEvento(c);
  assert.equal(e.tipo, "consequencia");
  assert.ok(!("destino" in e.consequencia), "a consequência ganhou um destino");
});

test("aplicada ao estado, a consequência oferece e não navega", () => {
  const naFila: EstadoDoWorkspace = { modo: "fila-de-decisoes", oferecidos: [], profundidade: 0 };
  const c: Consequencia = {
    resumo: "47 variantes atualizadas",
    afetados: 47,
    desbloqueios: [
      { modo: "pricing", quantos: null },
      { modo: "preparacao", quantos: 2, unidade: "produtos" },
    ],
  };
  const depois = aplicar(naFila, comoEvento(c));
  assert.equal(depois.modo, "fila-de-decisoes");
  assert.deepEqual([...depois.oferecidos].sort(), ["preparacao", "pricing"]);
});

test("ofertasQueValem: contagem ZERO não vira botão para tela vazia", () => {
  const c: Consequencia = {
    resumo: "x",
    afetados: 1,
    desbloqueios: [
      { modo: "pricing", quantos: 0, unidade: "produtos" },
      { modo: "preparacao", quantos: 3, unidade: "produtos" },
    ],
  };
  assert.deepEqual(ofertasQueValem(c).map((d) => d.modo), ["preparacao"]);
});

test("ofertasQueValem: `null` PASSA — 'não contei' não é 'contei e deu zero'", () => {
  const c: Consequencia = {
    resumo: "x",
    afetados: 1,
    desbloqueios: [{ modo: "pricing", quantos: null }],
  };
  assert.equal(ofertasQueValem(c).length, 1);
});

test("rotuloDoDesbloqueio: sem contagem, só o nome — nada é inventado", () => {
  assert.equal(rotuloDoDesbloqueio({ modo: "pricing", quantos: null }), "Pricing");
});

test("rotuloDoDesbloqueio: com contagem, o número real", () => {
  assert.equal(
    rotuloDoDesbloqueio({ modo: "preparacao", quantos: 2, unidade: "produtos" }),
    "Preparação — 2 produtos"
  );
});

test("rotuloDoDesbloqueio: singular correto — '1 produtos' denuncia a concatenação", () => {
  assert.equal(
    rotuloDoDesbloqueio({ modo: "preparacao", quantos: 1, unidade: "produtos" }),
    "Preparação — 1 produto"
  );
});

test("rotuloDoDesbloqueio: todo modo tem nome legível", () => {
  for (const modo of ["fila-de-decisoes", "triagem", "pricing", "draft", "preparacao"] as const) {
    const r = rotuloDoDesbloqueio({ modo, quantos: null });
    assert.ok(r.length > 0 && !r.includes("-"), `rotulo cru para ${modo}: ${r}`);
  }
});

test("o exemplo do enunciado, de ponta a ponta, sem trocar o modo sozinho", () => {
  const c: Consequencia = {
    resumo: "47 variantes atualizadas",
    afetados: 47,
    desbloqueios: [
      { modo: "pricing", quantos: null },
      { modo: "preparacao", quantos: 2, unidade: "produtos" },
    ],
  };
  let estado = aplicar(
    { ...ESTADO_INICIAL, modo: "fila-de-decisoes" },
    comoEvento(c)
  );
  assert.equal(estado.modo, "fila-de-decisoes");

  // O botão [Calcular preço] é uma INTENÇÃO. Só ele muda.
  estado = aplicar(estado, { tipo: "intencao", intencao: { destino: "pricing", origem: "clique" } });
  assert.equal(estado.modo, "pricing");
});
