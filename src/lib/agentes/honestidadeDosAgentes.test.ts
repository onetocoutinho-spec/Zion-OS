// Os dois lugares onde o sistema DAVA licença para inventar dado de produto —
// achados P0 da auditoria do Copilot (2026-08-22).
//
// 1. O A0 mandava "pesquisar fontes reais" (fabricante, Renner, Amazon,
//    "conhecimento geral") e rotular "(sugerido, fonte: X — validar)". A rota
//    de agentes não oferece busca nenhuma, então "fonte: X" só podia ser
//    inventada — e entrava no dossiê A1→A10 com carimbo de procedência.
// 2. A última linha do system prompt de /api/agentes/executar dizia "entregue
//    o melhor resultado possível e liste ao final o que faltou" — depois das
//    regras do agente, anulando a regra-mãe "NUNCA inventar dado de produto".
//
// Estes testes leem a FONTE: se alguém reescrever o prompt com a mesma ideia,
// o teste cai antes do anúncio.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENTES, REGRAS_MAE } from "./catalogo";

const A0 = AGENTES.A0;

/** A PROIBIÇÃO ("não pode usar conhecimento geral") não conta como uso. */
function semAProibicao(p: string): string {
  return p.replace(/não pode usar "conhecimento geral"/gi, "");
}

test("A0 não pede pesquisa externa nem 'conhecimento geral' — ele não tem fonte", () => {
  const p = semAProibicao(A0.promptSistema);
  assert.doesNotMatch(p, /conhecimento geral/i);
  assert.doesNotMatch(p, /pesquise|pesquisando|pesquisar\b/i);
  assert.doesNotMatch(p, /Renner|Amazon|fabricante \(ex/i);
  assert.doesNotMatch(p, /sugerido, fonte/i);
  assert.doesNotMatch(A0.objetivo, /preencher sozinho|sem depender do operador/i);
});

test("A0 declara que não tem acesso a fonte e só lista lacunas com a marca que o A10 reconhece", () => {
  const p = A0.promptSistema;
  assert.match(p, /NÃO TEM ACESSO A NENHUMA FONTE/);
  assert.match(p, /NUNCA preencha um campo/);
  assert.match(p, /⚠️ informação necessária: <campo>/);
  // A marca precisa ser a MESMA da regra-mãe, senão o A10 não a reconhece.
  assert.match(REGRAS_MAE, /⚠️ informação necessária: <campo>/);
});

test("a rota de agentes não manda 'entregar o melhor resultado possível' com dado faltando", () => {
  const rota = readFileSync(new URL("../../app/api/agentes/executar/route.ts", import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(rota, /melhor resultado possível/i);
  assert.match(rota, /NÃO a preencha/);
  assert.match(rota, /⚠️ informação necessária: <campo>/);
});

test("nenhum agente do catálogo pede 'conhecimento geral' para dado de produto", () => {
  for (const [codigo, agente] of Object.entries(AGENTES)) {
    assert.doesNotMatch(semAProibicao(agente.promptSistema), /conhecimento geral/i, `${codigo} usa "conhecimento geral"`);
  }
});
