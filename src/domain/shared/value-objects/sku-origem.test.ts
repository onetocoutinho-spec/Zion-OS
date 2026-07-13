// Testes de SkuOrigem — puros. Rodar: node --test src/domain/shared/value-objects/sku-origem.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SkuOrigem } from "./sku-origem.ts";

test("normaliza: trim, colapsa espaços e caixa alta", () => {
  const r = SkuOrigem.criar("  ts-200   pto ");
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.valor.valor, "TS-200 PTO");
});

test("rejeita vazio / só espaços", () => {
  assert.equal(SkuOrigem.criar("").ok, false);
  assert.equal(SkuOrigem.criar("   ").ok, false);
});

test("igualdade após normalização", () => {
  const a = SkuOrigem.criar("abc-1");
  const b = SkuOrigem.criar(" ABC-1 ");
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.equal(a.valor.igualA(b.valor), true);
});
