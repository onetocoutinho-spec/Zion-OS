// "Aprovado · nota 0/100" — a contradição que 790 linhas mostravam.
//
// 03/08/2026, no detalhe de um anúncio importado:
//
//     Veredito da IA: aprovado · nota 0/100
//
// Ninguém tira zero e é aprovado. `nota_diagnostico` é `integer NOT NULL
// default 0`, então "não avaliado" e "avaliado e tirou zero" caem no MESMO
// valor — e a tela pintava de vermelho um número que significava ausência de
// medição.
//
// Medido: 790 dos 880 anúncios da conta. É o defeito que atravessa este
// projeto — ausência virando afirmação — agora na apresentação de um número.

import test from "node:test";
import assert from "node:assert/strict";
import { foiAvaliadoPelaIA, notaExibivel, explicarVeredito } from "./notaExibivel.ts";

// ---------------------------------------------------------------------------
// A MARCA EXPLÍCITA MANDA
// ---------------------------------------------------------------------------

test("marcado como NÃO avaliado: a nota não é mostrada, nem como zero", () => {
  const r = { notaDiagnostico: 0, mlItemId: "MLB1", anuncio: { avaliadoPelaIA: false } };
  assert.equal(foiAvaliadoPelaIA(r), false);
  assert.equal(notaExibivel(r), null);
});

test("marcado como avaliado: a nota vale, mesmo sendo zero", () => {
  // Um anúncio que a esteira olhou e reprovou com zero É zero. A marca
  // explícita existe justamente para separar este caso do outro.
  const r = { notaDiagnostico: 0, mlItemId: "MLB1", anuncio: { avaliadoPelaIA: true } };
  assert.equal(notaExibivel(r), 0);
});

test("a marca vence a heurística, nos dois sentidos", () => {
  assert.equal(notaExibivel({ notaDiagnostico: 90, anuncio: { avaliadoPelaIA: false } }), null);
  assert.equal(
    notaExibivel({ notaDiagnostico: 0, mlItemId: "MLB1", anuncio: { avaliadoPelaIA: true } }),
    0
  );
});

// ---------------------------------------------------------------------------
// OS REGISTROS ANTIGOS, SEM A MARCA
// ---------------------------------------------------------------------------

test("veio do marketplace com nota zero: não avaliado", () => {
  // O caso dos 790.
  assert.equal(notaExibivel({ notaDiagnostico: 0, mlItemId: "MLB4980127845" }), null);
});

test("rascunho com nota zero É zero — passou pela esteira e tirou zero", () => {
  // Sem MLB, o anúncio nasceu aqui. A nota é uma medição, não uma ausência.
  assert.equal(notaExibivel({ notaDiagnostico: 0, mlItemId: null }), 0);
  assert.equal(notaExibivel({ notaDiagnostico: 0 }), 0);
});

test("publicado com nota real continua mostrando a nota", () => {
  // Os 2 anúncios que o Zion publicou têm MLB e nota > 0.
  assert.equal(notaExibivel({ notaDiagnostico: 87, mlItemId: "MLB4980127845" }), 87);
});

test("MLB em branco não conta como vindo do marketplace", () => {
  assert.equal(notaExibivel({ notaDiagnostico: 0, mlItemId: "   " }), 0);
});

// ---------------------------------------------------------------------------
// A FRASE
// ---------------------------------------------------------------------------

test("sem avaliação, a frase NÃO cita nota nenhuma", () => {
  const f = explicarVeredito({
    notaDiagnostico: 0,
    mlItemId: "MLB1",
    vereditoA10: "aprovado",
    anuncio: { avaliadoPelaIA: false },
  });
  assert.doesNotMatch(f, /0\/100/);
  assert.doesNotMatch(f, /aprovado/i, "afirmar veredito de quem não foi avaliado é a contradição original");
  assert.match(f, /n[ãa]o avaliou/i);
});

test("com avaliação, a frase traz veredito e nota", () => {
  const f = explicarVeredito({
    notaDiagnostico: 87,
    vereditoA10: "aprovado",
    anuncio: { avaliadoPelaIA: true },
  });
  assert.match(f, /aprovado/);
  assert.match(f, /87\/100/);
});

test("nunca sai a contradição 'aprovado · nota 0/100'", () => {
  // O teste que existe pelo print de 03/08/2026.
  for (const r of [
    { notaDiagnostico: 0, mlItemId: "MLB1", vereditoA10: "aprovado" },
    { notaDiagnostico: 0, mlItemId: "MLB1", vereditoA10: "aprovado", anuncio: { avaliadoPelaIA: false } },
  ]) {
    const f = explicarVeredito(r);
    assert.ok(
      !(/aprovado/i.test(f) && /0\/100/.test(f)),
      `a contradição voltou: "${f}"`
    );
  }
});
