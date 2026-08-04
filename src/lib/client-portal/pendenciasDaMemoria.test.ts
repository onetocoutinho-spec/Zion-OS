// Duas coisas com o mesmo nome — e o teste que impede a terceira.
//
// A Visão geral mostrava "Pendências abertas: 0" lendo a tabela `pendencias`
// (herança de agência, vazia) enquanto o menu "Pendências" listava dezenas do
// que o Mercado Livre cobra. Para a lojista o card é o resumo da tela, e ele
// afirmava que não havia o que fazer.
//
// O conserto não foi calcular certo no card: foi as duas telas passarem a
// chamar a MESMA montagem. Em 03/08/2026 o defeito "regra em dois lugares,
// consertada num só" apareceu três vezes — somar um quarto cálculo, ainda que
// correto hoje, seria construir a quarta com as próprias mãos.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pendenciasDaMemoria } from "./pendenciasDaMemoria.ts";

const an = (p: Record<string, unknown> = {}) => ({
  mlItemId: "MLB1",
  produto: "Chinelo X",
  mlPermalink: "https://x/MLB1",
  statusMarketplace: "active",
  statusMarketplaceEm: "2026-08-03T04:30:00Z",
  estoqueMarketplace: 10,
  subStatusMarketplace: [] as string[],
  fotoCapaMaxSize: "",
  ...p,
});

test("sem leitura gravada, devolve null — nunca um retrato vazio", () => {
  // `null` deixa a tela dizer "ainda não li"; um resumo zerado afirmaria que
  // não há pendência, que é a mentira que o card antigo contava.
  assert.equal(pendenciasDaMemoria([]), null);
  assert.equal(pendenciasDaMemoria([an({ statusMarketplace: null })]), null);
  assert.equal(pendenciasDaMemoria([an({ mlItemId: null })]), null);
});

test("a data do retrato é a leitura MAIS RECENTE", () => {
  const r = pendenciasDaMemoria([
    an({ statusMarketplaceEm: "2026-08-01T00:00:00Z" }),
    an({ mlItemId: "MLB2", statusMarketplaceEm: "2026-08-03T00:00:00Z" }),
  ]);
  assert.equal(r?.lidoEm, "2026-08-03T00:00:00Z");
  assert.equal(r?.lidos, 2);
});

test("o remédio do Mercado Livre atravessa até a lista", () => {
  const r = pendenciasDaMemoria([an()], {
    MLB1: [{ motivo: "A foto de capa não cumpre os requisitos.", remedio: "Corrija suas fotos." }],
  });
  const p = r?.itens.find((x) => x.tipo === "infracao-do-ml");
  assert.ok(p, "a infração não chegou à lista");
  assert.match(p!.oQueFazer, /Corrija suas fotos/);
});

test("sem infrações, a suspeita nossa continua se identificando como suspeita", () => {
  const r = pendenciasDaMemoria([an({ fotoCapaMaxSize: "900x1200" })]);
  const p = r?.itens.find((x) => x.tipo.startsWith("capa-"));
  assert.match(p!.porque, /suspeita nossa/);
});

// ---------------------------------------------------------------------------
// O SENTINELA: nenhuma tela pode montar isto por conta própria
// ---------------------------------------------------------------------------

test("as telas usam a montagem compartilhada, não uma cópia", () => {
  const telas = [
    "../../app/cliente/page.tsx",
    "../../components/client-portal/PendenciasDaConta.tsx",
  ];
  for (const rel of telas) {
    const fonte = readFileSync(new URL(rel, import.meta.url), "utf8").replace(/\r\n/g, "\n");
    assert.match(
      fonte,
      /pendenciasDaMemoria\(/,
      `${rel} deixou de usar a montagem compartilhada`
    );
    assert.ok(
      !/\bpendenciasDaConta\(/.test(fonte),
      `${rel} voltou a montar as pendências por conta própria — é a quarta duplicação`
    );
  }
});
