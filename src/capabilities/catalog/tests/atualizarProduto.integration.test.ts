// Integração REAL com atualizarProduto() (ENG-006) — prova o reuso do serviço
// existente e que a AIL/Journal engajam de verdade. Sem mockar arquitetura:
// usa o atualizarProduto REAL (default) sobre um produto-semente; em node o
// backend de persistência é inerte (infra externa), a AIL captura de verdade.
// Rodar: npx tsx --test src/capabilities/catalog/tests/atualizarProduto.integration.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { CatalogCapabilityAdapter } from "../CatalogCapabilityAdapter.ts";
import { InMemoryDecisionJournal } from "../../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

test("o Adapter usa atualizarProduto() REAL e a AIL registra a decisão no Journal", async () => {
  const journal = new InMemoryDecisionJournal();
  // Sem injetar 'atualizar' → usa o atualizarProduto REAL (produtos.ts).
  const adapter = new CatalogCapabilityAdapter("prd-01", journal);

  const res = await adapter.apply({ campo: "categoriaMarketplace", valor: "Calçados > Chinelos (teste)" });
  assert.equal(res.status, "completed");

  // capturarDecisao (evento existente da AIL) registrou no Journal injetado.
  assert.equal(journal.recebidas.length, 1);
  const d = journal.recebidas[0];
  assert.equal(d.campo, "categoriaMarketplace");
  assert.equal(d.contexto, "catalogo");
  assert.equal(d.entidade.id, "prd-01");
  assert.equal(d.valorNovo, "Calçados > Chinelos (teste)");
  assert.equal(d.origem, "produtos.atualizarProduto"); // a origem existente, não inventada
});
