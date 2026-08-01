// Pausar existe porque encerrar é definitivo demais para corrigir uma foto.
//
// ===========================================================================
// O QUE ISTO RESOLVE
// ===========================================================================
//
// 2026-08-01: a lojista publicou o Papete Modare e pediu para pausá-lo — as
// fotos estavam com a cor errada. O Zion não sabia pausar. Só sabia encerrar,
// que é TERMINAL: o anúncio sai do ar, não volta, e leva junto o histórico de
// relevância. A única saída dentro do sistema era destruir o anúncio para
// corrigir uma foto; ela foi ao painel do ML fazer à mão.
//
// O que estes testes protegem é a HONESTIDADE da mensagem. Reativar um anúncio
// pode voltar `under_review` — o ML revisa antes de recolocar na vitrine.
// Dizer "no ar de novo" nesse caso seria mentira, e o lojista descobriria
// sozinho olhando o painel.

import test from "node:test";
import assert from "node:assert/strict";
import { explicarEstado } from "./estadoDoAnuncioML.ts";

test("pausar confirmado diz o que foi preservado, não só o que aconteceu", () => {
  const f = explicarEstado("paused", "paused");
  assert.match(f, /pausad/i);
  assert.match(f, /hist[óo]rico/i, "não disse que o histórico ficou — é o motivo de não encerrar");
  assert.match(f, /reativ/i, "não disse que dá para voltar");
});

test("reativar que voltou `active` diz no ar, sem rodeio", () => {
  assert.match(explicarEstado("active", "active"), /no ar/i);
});

test("reativar que voltou `under_review` NÃO diz que está no ar", () => {
  // É o caso comum, e o mais fácil de mentir: pediu reativar, deu certo, mas o
  // anúncio ainda não está na vitrine.
  const f = explicarEstado("active", "under_review");
  assert.match(f, /revis/i);
  assert.doesNotMatch(f, /^An[úu]ncio no ar/i);
});

test("estado inesperado é repetido com a PALAVRA do ML", () => {
  // Nunca engolir: se o ML devolver algo que não conhecemos, aparece.
  assert.match(explicarEstado("paused", "payment_required"), /payment_required/);
  assert.match(explicarEstado("active", "closed"), /closed/);
});

test("pedir pausar e receber `active` é reportado como divergência", () => {
  // O ML aceitou a chamada e não pausou. Dizer "pausado" aqui seria afirmar
  // sobre um anúncio que continua vendendo.
  const f = explicarEstado("paused", "active");
  assert.doesNotMatch(f, /^An[úu]ncio pausado/i);
  assert.match(f, /active/);
});

test("nenhuma das mensagens fica vazia", () => {
  for (const pedido of ["paused", "active"] as const) {
    for (const confirmado of ["paused", "active", "under_review", "closed", "", "xyz"]) {
      assert.ok(explicarEstado(pedido, confirmado).length > 10, `${pedido}→${confirmado} ficou muda`);
    }
  }
});
