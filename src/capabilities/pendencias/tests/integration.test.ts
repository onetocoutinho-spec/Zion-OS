// Integração REAL (PR-1) — prova o reuso do serviço existente E da captura AIL,
// sem duplicar. Usa a pendência-semente `pen-01` (src/lib/data/pendencias.ts):
// em node o store lê os SEEDS e resolverPendencia resolve in-process, disparando
// a captura canônica (observarResolucao) no Journal injetado.
// Rodar: npx tsx --test src/capabilities/pendencias/tests/integration.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { PendenciasAdapter } from "../PendenciasAdapter.ts";
import { InMemoryDecisionJournal } from "../../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

test("resolverPendencia REAL resolve a semente e captura a decisão canônica no Journal", async () => {
  const journal = new InMemoryDecisionJournal();
  // Sem injetar o serviço → usa o resolverPendencia REAL (pendencias.ts).
  const adapter = new PendenciasAdapter(journal);

  const res = await adapter.resolver({ acao: "resolver", pendenciaId: "pen-01" });
  assert.equal(res.status, "completed"); // a semente foi resolvida (repo.atualizar)

  assert.equal(journal.recebidas.length, 1);
  const d = journal.recebidas[0];
  assert.equal(d.campo, "informacaoPendente");
  assert.equal(d.contexto, "catalogo");
  assert.equal(d.valorAnterior, null); // a informação estava AUSENTE
  assert.equal(d.valorNovo, "Enviar acesso do TikTok Shop"); // descricao da semente
  assert.equal(d.empresa, "cli-03"); // clienteId da semente
  assert.equal(d.origem, "pendencias.resolverPendencia"); // origem existente, não inventada
  assert.deepEqual(d.entidade, { tipo: "pendencia", id: "pen-01" });
});
