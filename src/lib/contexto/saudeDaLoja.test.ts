// Testes da saúde derivada da loja. Puros.
// Rodar: node --test src/lib/contexto/saudeDaLoja.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { saudeDaLoja } from "./saudeDaLoja.ts";
import type { Cliente } from "../types.ts";

function loja(p: Partial<Cliente> = {}): Cliente {
  return {
    id: "A",
    empresa: "Loja A",
    responsavel: "",
    segmento: "",
    marketplaces: ["Mercado Livre"],
    plano: "",
    status: "Ativo",
    dataEntrada: "2026-01-01",
    proximaReuniao: null,
    proximaAcao: "",
    risco: "Baixo",
    observacoes: "",
    ...p,
  };
}

test("loja ativa, com marketplace e sem sinais → saudável, com motivo", () => {
  const s = saudeDaLoja(loja());
  assert.equal(s.nivel, "ok");
  assert.equal(s.forma, "●");
  assert.match(s.motivo, /sem pendências/);
});

test("override manual da equipe pesa: risco Alto → em risco", () => {
  const s = saudeDaLoja(loja({ risco: "Alto" }));
  assert.equal(s.nivel, "risco");
  assert.equal(s.forma, "▲");
});

test("sem marketplace conectado → atenção, e o motivo diz isso", () => {
  const s = saudeDaLoja(loja({ marketplaces: [] }));
  assert.equal(s.nivel, "atencao");
  assert.match(s.motivo, /nenhum marketplace/);
});

test("anúncios com problema: poucos → atenção; 10+ → risco", () => {
  assert.equal(saudeDaLoja(loja(), { anunciosComProblema: 3 }).nivel, "atencao");
  assert.equal(saudeDaLoja(loja(), { anunciosComProblema: 12 }).nivel, "risco");
});

test("o motivo lista só os motivos do nível mais grave", () => {
  const s = saudeDaLoja(loja({ risco: "Alto", marketplaces: [] }));
  assert.equal(s.nivel, "risco");
  assert.doesNotMatch(s.motivo, /marketplace/);
});

test("cota de IA a 90%+ → atenção", () => {
  assert.equal(saudeDaLoja(loja(), { cotaUsadaPct: 95 }).nivel, "atencao");
  assert.equal(saudeDaLoja(loja(), { cotaUsadaPct: 50 }).nivel, "ok");
});
