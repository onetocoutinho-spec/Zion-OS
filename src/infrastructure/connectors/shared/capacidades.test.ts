// Testes de capacidades — puros.
import { test } from "node:test";
import assert from "node:assert/strict";
import { declararCapacidades, suporta } from "./capacidades.ts";

test("declararCapacidades + suporta refletem o que foi declarado", () => {
  const caps = declararCapacidades("publicar", "pausar");
  assert.equal(suporta(caps, "publicar"), true);
  assert.equal(suporta(caps, "pausar"), true);
  assert.equal(suporta(caps, "atualizar_preco_estoque"), false);
});

test("conjunto vazio não suporta nada", () => {
  const caps = declararCapacidades();
  assert.equal(suporta(caps, "publicar"), false);
});
