// Testes do Natural Aggregate MARKETPLACE (Signal Source: salvarCanal — PR-004).
//
// salvarCanal é Supabase-only (early-return no modo demo), então a lógica de
// captura vive no builder PURO montarCapturaTipoAnuncio — testado aqui sem
// banco. O wiring dentro de salvarCanal é trivial e espelha o padrão provado
// (leitura prévia condicional + capturarDecisao fire-and-forget).
// Rodar: npx tsx --test src/lib/services/canaisMarketplace.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { montarCapturaTipoAnuncio, type CanalMarketplace } from "./canaisMarketplace.ts";
import { capturarDecisao } from "../../modules/adaptive-intelligence/decision-journal.ts";
import { InMemoryDecisionJournal } from "../../modules/adaptive-intelligence/infrastructure/decision-journal.memory.ts";

const canalExistente: CanalMarketplace = {
  id: "canal-01",
  clienteId: "cli-01",
  marketplace: "Mercado Livre",
  sellerId: "123",
  tipoAnuncio: "Premium", // default do sistema = a PROPOSTA (RFC-AIL-001 §5)
  ativo: true,
};

test("sem tipoAnuncio no payload → NÃO é decisão sobre tipo (null)", () => {
  const captura = montarCapturaTipoAnuncio({ clienteId: "cli-01", ativo: false } as never, null);
  assert.equal(captura, null);
});

test("canal novo: decisão ausente→valor, entidade determinística", () => {
  const captura = montarCapturaTipoAnuncio(
    { clienteId: "cli-01", tipoAnuncio: "Classic" },
    null
  );
  assert.ok(captura);
  assert.equal(captura.contexto, "publicacao"); // Bounded Context canônico
  assert.equal(captura.campo, "tipoAnuncio");
  assert.equal(captura.valorAnterior, null);
  assert.equal(captura.valorNovo, "Classic");
  assert.equal(captura.empresa, "cli-01");
  assert.deepEqual(captura.entidade, { tipo: "canal", id: "cli-01:Mercado Livre" });
  assert.equal(captura.origem, "canaisMarketplace.salvarCanal");
});

test("canal existente: valorAnterior é a proposta vigente do sistema", () => {
  const captura = montarCapturaTipoAnuncio(
    { clienteId: "cli-01", tipoAnuncio: "Classic" },
    canalExistente
  );
  assert.ok(captura);
  assert.equal(captura.valorAnterior, "Premium");
  assert.equal(captura.valorNovo, "Classic");
  assert.deepEqual(captura.entidade, { tipo: "canal", id: "canal-01" });
});

test("ponta-a-ponta com capturarDecisao: mesma escolha NÃO vira memória", () => {
  const journal = new InMemoryDecisionJournal();
  const semDelta = montarCapturaTipoAnuncio(
    { clienteId: "cli-01", tipoAnuncio: "Premium" },
    canalExistente
  );
  assert.ok(semDelta);
  capturarDecisao(semDelta, journal); // Premium → Premium: sem delta
  assert.equal(journal.recebidas.length, 0);

  const comDelta = montarCapturaTipoAnuncio(
    { clienteId: "cli-01", tipoAnuncio: "Classic" },
    canalExistente
  );
  assert.ok(comDelta);
  capturarDecisao(comDelta, journal);
  assert.equal(journal.recebidas.length, 1);
  assert.equal(journal.recebidas[0].valorNovo, "Classic");
});
