// PendenciasAdapter (PR-1) — integração com resolverPendencia (stubado).
// Rodar: npx tsx --test src/capabilities/pendencias/tests/PendenciasAdapter.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { PendenciasAdapter } from "../PendenciasAdapter.ts";
import { InMemoryDecisionJournal } from "../../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";
import type { DecisionJournal } from "../../../modules/adaptive-intelligence/decision-journal.ts";
import type { Pendencia } from "../../../lib/types.ts";

function pendencia(id: string): Pendencia {
  return { id, clienteId: "cli-03", cliente: "FitPro", tarefaId: null, tarefa: null, descricao: "Enviar acesso", resolvida: true };
}

function stubResolver(retorno: (id: string) => Pendencia | null) {
  const calls: { id: string; journal?: DecisionJournal }[] = [];
  const fn = async (id: string, journal?: DecisionJournal): Promise<Pendencia | null> => {
    calls.push({ id, journal });
    return retorno(id);
  };
  return { fn, calls };
}

test("resolver chama resolverPendencia com id + journal → completed", async () => {
  const s = stubResolver((id) => pendencia(id));
  const journal = new InMemoryDecisionJournal();
  const adapter = new PendenciasAdapter(journal, s.fn);
  const res = await adapter.resolver({ acao: "resolver", pendenciaId: "pen-01" });
  assert.equal(res.status, "completed");
  assert.equal(s.calls[0].id, "pen-01");
  assert.equal(s.calls[0].journal, journal); // repassa o Port da AIL existente (reuso)
});

test("pendência inexistente (null) → failed", async () => {
  const adapter = new PendenciasAdapter(undefined, async () => null);
  assert.equal((await adapter.resolver({ acao: "resolver", pendenciaId: "pen-x" })).status, "failed");
});

test("exceção da infraestrutura → failed (fronteira não vaza)", async () => {
  const adapter = new PendenciasAdapter(undefined, async () => { throw new Error("db down"); });
  assert.equal((await adapter.resolver({ acao: "resolver", pendenciaId: "pen-01" })).status, "failed");
});
