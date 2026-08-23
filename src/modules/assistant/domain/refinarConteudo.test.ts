// Edição por instrução — item 7 (NEXT) do roadmap da auditoria (2026-08-22).
// "Deixa mais curto" não tinha caminho: chamar de novo regerava do zero com os
// mesmos quatro campos, e a lojista perdia o que já tinha aprovado.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FERRAMENTAS } from "./ferramentasDoAssistente";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) =>
  readFileSync(new URL(rel, raiz), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("propor_titulo e propor_descricao aceitam `instrucao` — e só elas, por enquanto", () => {
  for (const nome of ["propor_titulo", "propor_descricao"]) {
    const f = FERRAMENTAS.find((x) => x.nome === nome)!;
    const props = (f.parametros as { properties: Record<string, unknown> }).properties;
    assert.ok("instrucao" in props, `${nome} sem instrucao`);
    assert.match(f.descricao, /AJUSTE/);
  }
});

test("a instrução chega ao agente cercada como dado, com a ordem de preservar o resto", () => {
  const t = ler("lib/services/agenteDeTitulo.ts");
  assert.match(t, /dadoExterno\("pedido-do-lojista", e\.instrucao\)/);
  assert.match(t, /mude SÓ o que o ajuste pede/);
  const d = ler("lib/services/agenteDeDescricao.ts");
  assert.match(d, /dadoExterno\("pedido-da-lojista", e\.instrucao\)/);
  assert.match(d, /Os parágrafos que ela não questionou ficam como estão/);
});

test("título acima de 60 ganha UMA retentativa com o motivo — não uma recusa seca", () => {
  const exec = ler("modules/assistant/domain/executarFerramenta.ts");
  const fn = exec.slice(exec.indexOf("async function proporTitulo("), exec.indexOf("async function analisarPendencias("));
  assert.match(fn, /retentativaPor: veredicto\.motivo/);
  assert.match(fn, /\/caracteres\/i\.test\(veredicto\.motivo\)/, "a retentativa dispara em qualquer recusa, não só no tamanho");
  // Teto de UMA: não há laço.
  assert.doesNotMatch(fn, /while\s*\(/);
  assert.equal((fn.match(/a\.gerarTitulo\(/g) ?? []).length, 2);
  const t = ler("lib/services/agenteDeTitulo.ts");
  assert.match(t, /A TENTATIVA ANTERIOR FOI RECUSADA/);
  assert.match(t, /cortando do fim/);
});

test("a instrução tem teto — 300 caracteres — e entra vazia como ausente", () => {
  const exec = ler("modules/assistant/domain/executarFerramenta.ts");
  assert.equal((exec.match(/texto\(args, "instrucao"\)\.slice\(0, 300\) \|\| undefined/g) ?? []).length, 2);
});
