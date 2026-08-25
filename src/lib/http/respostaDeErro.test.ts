// ZION-API-001 — a mensagem de terceiro fica no servidor.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { mensagemEhPublica, mensagemParaONavegador, respostaDeErro } from "./respostaDeErro.ts";
import { ErroAutorizacao } from "../auth/serverAuthorization.ts";
import { RenovacaoRecusadaError } from "../marketplaces/mercadolivre.ts";

const PUBLICA = "Falha ao consultar o Mercado Livre.";

test("erro de SDK/driver -> a mensagem pública, nunca a dele", () => {
  const vazamentos = [
    new Error("401 {\"type\":\"authentication_error\",\"message\":\"invalid x-api-key\"} model=claude-opus-5"),
    new Error("FATAL: password authentication failed for user \"postgres\""),
    new Error("getaddrinfo ENOTFOUND api.mercadolibre.com"),
    new TypeError("fetch failed"),
    "uma string",
    undefined,
  ];
  for (const e of vazamentos) {
    assert.equal(mensagemEhPublica(e), false);
    assert.equal(mensagemParaONavegador(e, PUBLICA), PUBLICA);
  }
});

test("erro que o app escreveu para a pessoa -> passa como está", () => {
  const auth = new ErroAutorizacao(403, "Sem permissão para este recurso.");
  assert.equal(mensagemEhPublica(auth), true);
  assert.equal(mensagemParaONavegador(auth, PUBLICA), "Sem permissão para este recurso.");

  const renov = new RenovacaoRecusadaError(400, "invalid_grant");
  assert.equal(mensagemParaONavegador(renov, PUBLICA), renov.message);
});

test("um Error solto com name forjado não passa — a lista é fechada", () => {
  const e = new Error("model=claude-opus-5 rate_limit");
  e.name = "QualquerCoisa";
  assert.equal(mensagemEhPublica(e), false);
});

test("respostaDeErro: status, corpo e extras", async () => {
  const r = respostaDeErro("teste", new Error("segredo do provedor"), PUBLICA, 502, { aviso: "x" });
  assert.equal(r.status, 502);
  const corpo = (await r.json()) as { erro: string; aviso?: string };
  assert.equal(corpo.erro, PUBLICA);
  assert.equal(corpo.aviso, "x");
  assert.ok(!JSON.stringify(corpo).includes("segredo"));
});

// ---- as rotas — nenhuma repassa e.message crua ----

test("nenhuma rota /api devolve `e.message` de um erro não classificado", () => {
  // O padrão exato que a auditoria encontrou 20 vezes. Depois desta mudança,
  // a única forma aceitável de `e.message` ir ao navegador é por
  // mensagemParaONavegador/respostaDeErro, que decidem pela classe.
  const raiz = join(dirname(fileURLToPath(import.meta.url)), "../../app/api");
  const rotas: string[] = [];
  (function andar(d: string) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) andar(p);
      else if (e.name === "route.ts") rotas.push(p);
    }
  })(raiz);

  const ofensores: string[] = [];
  for (const rota of rotas) {
    const fonte = readFileSync(rota, "utf8").replace(/^\s*\/\/.*$/gm, "");
    // O padrão: `e.message` cru indo para um campo `erro`/`aviso` da RESPOSTA.
    // Dois formatos: o ternário direto no corpo, e a variável
    // `const x = e instanceof Error ? e.message : ...` que depois entra numa
    // template string do corpo.
    //
    // Fica de fora, de propósito, o objeto de diagnóstico de
    // ml/diagnostico-infracoes (`exceção no nosso código: ...`): ele devolve a
    // exceção de REDE a um operador autorizado, e isso é a função da rota.
    const ternarioNoCorpo = /Response\.json\(\s*\{[^}]*?\b(?:erro|aviso)\s*:\s*(?:`[^`]*\$\{)?\s*\w+\s+instanceof\s+Error\s*\?\s*\w+\.message/g;
    const variavelCruaNoCorpo =
      /const (\w+) = \w+ instanceof Error \? \w+\.message[^;]*;[\s\S]{0,600}?Response\.json\([\s\S]{0,300}?\$\{\1\}/g;
    const m = [...(fonte.match(ternarioNoCorpo) ?? []), ...(fonte.match(variavelCruaNoCorpo) ?? [])];
    if (m.length) ofensores.push(`${rota.slice(raiz.length + 1)} (${m.length}×)`);
  }
  assert.deepEqual(ofensores, [], "rotas repassando e.message cru ao navegador");
});
