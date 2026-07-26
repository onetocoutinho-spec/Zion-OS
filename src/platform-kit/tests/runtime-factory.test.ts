// Testes oficiais da conveniência de construção do Runtime.
//
// FONTE NORMATIVA ÚNICA: ADR-010 (Composition Root de Integração).
//
// Provam as duas garantias que a ADR-010 declara como consequências:
//   1. Comportamento de execução inalterado — o Runtime obtido pela conveniência
//      se comporta como o obtido pela construção explícita.
//   2. Manutenção da opcionalidade — o composition root explícito permanece
//      válido, suficiente e suportado.
//
// Validam COMPORTAMENTO observável (a sequência e o conteúdo semântico dos
// eventos publicados), nunca detalhes de implementação.
//
// Rodar: npx tsx --test src/platform-kit/tests/runtime-factory.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { criarRuntime } from "../runtime-factory.ts";
import { Runtime } from "../../runtime/Runtime.ts";
import { DecisionFactory } from "../../runtime/decision/DecisionFactory.ts";
import { RuntimeDispatcher } from "../../runtime/dispatcher/RuntimeDispatcher.ts";
import type { CapabilityPort } from "../../runtime/ports/CapabilityPort.ts";
import type { ShellPort } from "../../runtime/ports/ShellPort.ts";
import type { RuntimeEvent, UserIntent } from "../../runtime/contracts/runtime.ts";

const flush = () => new Promise((r) => setTimeout(r, 0));

const capacidadeQueConclui: CapabilityPort = { execute: async () => ({ status: "completed" }) };
const capacidadeQueFalha: CapabilityPort = { execute: async () => ({ status: "failed", detail: "motivo" }) };

/** Coletor de eventos publicados — a porta que a superfície informa. */
function coletor() {
  const eventos: RuntimeEvent[] = [];
  const porta: ShellPort = { publish: (e) => eventos.push(e) };
  // Resumo semântico: estável entre instâncias (não depende de id nem de relógio).
  const resumo = () => eventos.map((e) => ({ tipo: e.type, missao: e.missionId, estado: e.response?.status }));
  return { porta, resumo, quantidade: () => eventos.length };
}

const intencao = (): UserIntent => ({ missionId: "missao-oficial", type: "answer", payload: "valor", timestamp: 1 });

/** Construção explícita — o caminho que a ADR-010 mantém válido. */
function construirExplicitamente(capability: CapabilityPort, porta: ShellPort): Runtime {
  return new Runtime(new DecisionFactory(), new RuntimeDispatcher(capability, porta), porta);
}

test("comportamento inalterado: a conveniência produz o mesmo resultado que a construção explícita", async () => {
  const explicito = coletor();
  construirExplicitamente(capacidadeQueConclui, explicito.porta).receive(intencao());
  await flush();

  const porConveniencia = coletor();
  criarRuntime(capacidadeQueConclui, porConveniencia.porta).receive(intencao());
  await flush();

  assert.deepEqual(porConveniencia.resumo(), explicito.resumo());
});

test("comportamento inalterado no caminho de falha: a conveniência não intercepta nem altera eventos", async () => {
  const explicito = coletor();
  construirExplicitamente(capacidadeQueFalha, explicito.porta).receive(intencao());
  await flush();

  const porConveniencia = coletor();
  criarRuntime(capacidadeQueFalha, porConveniencia.porta).receive(intencao());
  await flush();

  assert.deepEqual(porConveniencia.resumo(), explicito.resumo());
});

test("opcionalidade: o composition root explícito permanece válido e suficiente", async () => {
  const explicito = coletor();
  construirExplicitamente(capacidadeQueConclui, explicito.porta).receive(intencao());
  await flush();

  assert.deepEqual(
    explicito.resumo().map((e) => e.tipo),
    ["DecisionCreated", "CapabilityRequested", "CapabilityCompleted"],
  );
});

test("o envio da intenção permanece com a superfície: nada é publicado sem receive", async () => {
  const c = coletor();
  criarRuntime(capacidadeQueConclui, c.porta);
  await flush();

  assert.equal(c.quantidade(), 0);
});

test("os eventos são publicados na porta informada pela superfície", async () => {
  const informada = coletor();
  const naoInformada = coletor();
  criarRuntime(capacidadeQueConclui, informada.porta).receive(intencao());
  await flush();

  assert.ok(informada.quantidade() > 0);
  assert.equal(naoInformada.quantidade(), 0);
});
