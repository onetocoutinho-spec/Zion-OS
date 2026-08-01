// O estado NO MARKETPLACE é outro eixo — e não pode mentir por omissão.
//
// ===========================================================================
// O DEFEITO QUE ORIGINOU A COLUNA
// ===========================================================================
//
// O importador gravava `status: "publicado"` FIXO em todo anúncio que trazia do
// Mercado Livre. Medido em 2026-08-01, com a leitura completa da conta (781
// anúncios, depois que o teto mudo de 500 caiu):
//
//     No ML (781)          já no Zion      faltando
//     546 active              398             148
//     155 under_review         52             103
//      66 paused               38              28
//      12 closed               12               0
//       2 inactive              2               0
//
// Dos 511 anúncios que o Zion dizia `publicado`, **104 não estavam no ar**.
//
// A migração 050 deu um lugar para a verdade. Estes testes protegem o que ela
// diz quando NÃO sabe — que é onde a mentira anterior morava.

import test from "node:test";
import assert from "node:assert/strict";
import { rotuloStatusMarketplace } from "./anunciosGerados.ts";

test("cada estado do ML tem rótulo e tom próprios", () => {
  assert.deepEqual(rotuloStatusMarketplace("active"), { texto: "No ar", tom: "ok" });
  assert.deepEqual(rotuloStatusMarketplace("paused"), { texto: "Pausado no ML", tom: "atencao" });
  assert.deepEqual(rotuloStatusMarketplace("under_review"), {
    texto: "Em revisão pelo ML",
    tom: "atencao",
  });
  assert.deepEqual(rotuloStatusMarketplace("closed"), { texto: "Encerrado no ML", tom: "ruim" });
  assert.deepEqual(rotuloStatusMarketplace("inactive"), { texto: "Inativo no ML", tom: "ruim" });
});

test("`null` NÃO vira 'no ar' — é o defeito inteiro em uma linha", () => {
  const r = rotuloStatusMarketplace(null);
  assert.equal(r.tom, "neutro");
  assert.notEqual(r.texto, "No ar");
  assert.match(r.texto, /desconhecid/i);
});

test("undefined e vazio caem no mesmo lugar que null", () => {
  assert.deepEqual(rotuloStatusMarketplace(undefined), rotuloStatusMarketplace(null));
  assert.deepEqual(rotuloStatusMarketplace("   "), rotuloStatusMarketplace(null));
});

test("estado que o Zion não conhece aparece com a PALAVRA do ML, não some", () => {
  // Se o Mercado Livre criar um estado novo amanhã, ele fica visível em vez de
  // ser engolido por um `default`. Um "—" aqui recriaria a mudez.
  const r = rotuloStatusMarketplace("payment_required");
  assert.match(r.texto, /payment_required/);
  assert.equal(r.tom, "neutro");
});

test("`active` também ganha selo — selo só no caso ruim treina a ignorar o campo", () => {
  assert.equal(rotuloStatusMarketplace("active").tom, "ok");
});

test("a caixa da palavra não muda a leitura", () => {
  assert.deepEqual(rotuloStatusMarketplace("PAUSED"), rotuloStatusMarketplace("paused"));
  assert.deepEqual(rotuloStatusMarketplace("Under_Review"), rotuloStatusMarketplace("under_review"));
});

test("nenhum estado conhecido do ML colide com outro", () => {
  const estados = ["active", "paused", "under_review", "closed", "inactive"];
  const textos = new Set(estados.map((e) => rotuloStatusMarketplace(e).texto));
  assert.equal(textos.size, estados.length, "dois estados do ML mostram o mesmo texto");
  assert.ok(!textos.has(rotuloStatusMarketplace(null).texto), "um estado conhecido virou 'desconhecido'");
});
