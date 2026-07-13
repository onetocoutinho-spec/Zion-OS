// Testes das estratégias de auth — puros.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ESTRATEGIAS_AUTH, precisaRenovar } from "./estrategia-auth.ts";
import { TIPOS_ESTRATEGIA_AUTH } from "./credencial.ts";

test("precisaRenovar: só oauth2 renova", () => {
  assert.equal(precisaRenovar("oauth2"), true);
  assert.equal(precisaRenovar("api_key"), false);
  assert.equal(precisaRenovar("arquivo"), false);
  assert.equal(precisaRenovar("nenhuma"), false);
});

test("há um descritor coerente para cada estratégia declarada", () => {
  for (const tipo of TIPOS_ESTRATEGIA_AUTH) {
    const d = ESTRATEGIAS_AUTH[tipo];
    assert.equal(d.tipo, tipo);
    assert.ok(d.descricao.length > 0);
    assert.equal(typeof d.precisaRenovacao, "boolean");
  }
});
