// "Otimizado" era a palavra errada para 791 anúncios.
//
// Medido no banco de produção em 03/08/2026:
//
//     880  anúncios
//     791  apareciam como "Otimizado"
//       0  tinham sido avaliados pela IA
//     787  eram importados do Mercado Livre
//
// A regra antiga era `status === "aprovado" || "publicado"`, e todo importado
// nasce `publicado`. A tela mostrava "Otimizado" e "Score IA —" na MESMA LINHA.

import test from "node:test";
import assert from "node:assert/strict";
import { estadoDeOtimizacao } from "./metrics.ts";

const an = (p: Record<string, unknown> = {}) => ({
  produtoId: "P1",
  status: "publicado" as const,
  notaDiagnostico: 0,
  criadoEm: "2026-08-01T00:00:00Z",
  ...p,
});

test("importado do ML: no ar, e NÃO otimizado", () => {
  // Este é o caso dos 787. Nasce `publicado` com nota 0.
  const m = estadoDeOtimizacao([an()]);
  assert.equal(m.get("P1"), "No ar, sem otimização");
});

test("passou pela esteira e está no ar: otimizado", () => {
  const m = estadoDeOtimizacao([an({ notaDiagnostico: 72 })]);
  assert.equal(m.get("P1"), "Otimizado");
});

test("nota zero NUNCA vira otimizado — zero é ausência de medição", () => {
  // A convenção já existia no repositório e o rótulo a ignorava.
  for (const status of ["publicado", "aprovado"]) {
    assert.equal(estadoDeOtimizacao([an({ status })]).get("P1"), "No ar, sem otimização");
  }
});

test("fora do ar continua 'Em revisão', com ou sem nota", () => {
  assert.equal(estadoDeOtimizacao([an({ status: "rascunho" })]).get("P1"), "Em revisão");
  assert.equal(
    estadoDeOtimizacao([an({ status: "rascunho", notaDiagnostico: 90 })]).get("P1"),
    "Em revisão"
  );
});

test("vale o anúncio MAIS RECENTE do produto", () => {
  const m = estadoDeOtimizacao([
    an({ criadoEm: "2026-07-01T00:00:00Z", notaDiagnostico: 88 }),
    an({ criadoEm: "2026-08-02T00:00:00Z", notaDiagnostico: 0 }),
  ]);
  assert.equal(m.get("P1"), "No ar, sem otimização");
});

test("anúncio sem produto não entra no mapa", () => {
  assert.equal(estadoDeOtimizacao([an({ produtoId: "" })]).size, 0);
});

test("nota que chega como texto não vira otimizado por acidente", () => {
  // Campo atravessa JSON; supor o tipo é supor o valor.
  assert.equal(
    estadoDeOtimizacao([an({ notaDiagnostico: "0" as unknown as number })]).get("P1"),
    "No ar, sem otimização"
  );
});
