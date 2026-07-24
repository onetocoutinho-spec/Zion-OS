// catalog-events (ENG-006) — reutiliza o contrato CapabilityResponse (ENG-005);
// nenhum evento novo é inventado.
// Rodar: npx tsx --test src/capabilities/catalog/tests/catalog-events.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { catalogCompleted, catalogFailed } from "../catalog-events.ts";

test("catalogCompleted/catalogFailed produzem o CapabilityResponse existente", () => {
  assert.deepEqual(catalogCompleted({ produtoId: "p1" }), { status: "completed", detail: { produtoId: "p1" } });
  assert.deepEqual(catalogFailed("motivo"), { status: "failed", detail: "motivo" });
});
