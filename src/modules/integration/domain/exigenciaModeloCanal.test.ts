// Testes da Capability de exigência do modelo do canal. Puros, sem rede/ML.
// Rodar: node --test src/modules/integration/domain/exigenciaModeloCanal.test.ts
//
// Migrados de `lib/marketplaces/mlUserProducts.test.ts` na Release 007 (R11),
// junto com o código que exercitam. Asserções preservadas byte a byte.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dominioDaCategoria, precisaUserProducts } from "./exigenciaModeloCanal.ts";

// ---- helpers de categoria ----

test("precisaUserProducts só é true para categorias mapeadas", () => {
  assert.equal(precisaUserProducts("MLB273770"), true);
  assert.equal(precisaUserProducts("MLB1234"), false);
});

test("dominioDaCategoria resolve MLB273770 e nega o resto", () => {
  assert.equal(dominioDaCategoria("MLB273770"), "SANDALS_AND_CLOGS");
  assert.equal(dominioDaCategoria("MLB1234"), null);
});
