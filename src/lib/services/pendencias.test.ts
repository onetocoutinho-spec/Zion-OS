// Testes do primeiro Producer da Adaptive Intelligence Layer (R-DJ-2).
//
// resolverPendencia passou a OBSERVAR a resolução como uma Decision no Decision
// Journal. Estes testes verificam que:
//   1. resolver uma pendência real registra EXATAMENTE uma Decision canônica;
//   2. a observação é estritamente fire-and-forget — um Journal que LANÇA não
//      altera o resultado da resolução;
//   3. uma resolução sem efeito (id inexistente) NÃO registra nenhuma Decision;
//   4. o caminho de produção (sem injeção) usa o NoOp da Factory e não lança.
//
// Não tocam banco nem rede: em Node o store lê os SEEDS de src/lib/data e o
// write é no-op (typeof window === "undefined").
// Rodar: npx tsx --test src/lib/services/pendencias.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { resolverPendencia } from "./pendencias.ts";
import { InMemoryDecisionJournal } from "../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";
import type {
  DecisionJournal,
  Decision,
} from "../../modules/adaptive-intelligence/decision-journal.ts";

// pen-01 existe nos SEEDS (src/lib/data/pendencias.ts): resolvida:false, cli-03.
const ID_SEED = "pen-01";
const CLIENTE_SEED = "cli-03";

test("resolver uma pendência real registra EXATAMENTE uma Decision", async () => {
  const journal = new InMemoryDecisionJournal();
  const resultado = await resolverPendencia(ID_SEED, journal);
  assert.ok(resultado, "a pendência seed deve ser resolvida");
  assert.equal(resultado.resolvida, true);
  assert.equal(journal.recebidas.length, 1);
});

test("a Decision registrada é canônica e descreve a resolução", async () => {
  const journal = new InMemoryDecisionJournal();
  await resolverPendencia(ID_SEED, journal);
  const d: Decision = journal.recebidas[0];
  assert.equal(d.contexto, "pendencia");
  assert.deepEqual(d.entidade, { tipo: "pendencia", id: ID_SEED });
  assert.equal(d.campo, "resolvida");
  assert.equal(d.valorAnterior, "false");
  assert.equal(d.valorNovo, "true");
  assert.equal(d.empresa, CLIENTE_SEED); // tenant vem do resultado da persistência
  assert.equal(d.origem, "pendencias.resolverPendencia");
  assert.equal(d.correlacao, null);
  assert.ok(d.id.length > 0, "id da Decision deve ser gerado");
  assert.ok(!Number.isNaN(Date.parse(d.timestamp)), "timestamp deve ser ISO válido");
});

test("é fire-and-forget: um Journal que LANÇA não altera a resolução", async () => {
  const jornalQueLanca: DecisionJournal = {
    registrarDecisao() {
      throw new Error("falha simulada do Journal");
    },
  };
  // Se a exceção NÃO fosse contida, este await rejeitaria e o teste falharia.
  const resultado = await resolverPendencia(ID_SEED, jornalQueLanca);
  assert.ok(resultado, "a resolução deve ocorrer mesmo com o Journal falhando");
  assert.equal(resultado.resolvida, true);
});

test("id inexistente não resolve nada e NÃO registra Decision", async () => {
  const journal = new InMemoryDecisionJournal();
  const resultado = await resolverPendencia("pen-inexistente-zzz", journal);
  assert.equal(resultado, null);
  assert.equal(journal.recebidas.length, 0);
});

test("padrão de produção: sem injeção usa o NoOp da Factory e não lança", async () => {
  // Chamada como no app (só o id). A Factory resolve o NoOp; nada observável.
  await assert.doesNotReject(async () => {
    await resolverPendencia(ID_SEED);
  });
});
