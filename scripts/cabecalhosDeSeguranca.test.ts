// ZION-INFRA-001 — os cabeçalhos de segurança existem e cobrem tudo.
//
// Em 106f95a `next.config.ts` não tinha `headers()`: sem `frame-ancestors`,
// clickjacking era explorável com um clique. Medido no servidor de dev em
// 21/08/2026 com `curl -sI`: os seis cabeçalhos respondem e a CSP em
// Report-Only não acusou violação nenhuma no dashboard nem no portal.

import { test } from "node:test";
import assert from "node:assert/strict";
import config from "../next.config.ts";

async function cabecalhos(): Promise<Map<string, string>> {
  const regras = await config.headers!();
  const todas = regras.find((r) => r.source === "/(.*)");
  assert.ok(todas, "a regra precisa cobrir TODAS as rotas — uma tela de fora é uma tela embutível");
  return new Map(todas.headers.map((h) => [h.key.toLowerCase(), h.value]));
}

test("ninguém embute o app: X-Frame-Options DENY e frame-ancestors 'none'", async () => {
  const h = await cabecalhos();
  assert.equal(h.get("x-frame-options"), "DENY");
  assert.match(h.get("content-security-policy-report-only") ?? "", /frame-ancestors 'none'/);
});

test("nosniff, referrer e permissions", async () => {
  const h = await cabecalhos();
  assert.equal(h.get("x-content-type-options"), "nosniff");
  assert.equal(h.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.match(h.get("permissions-policy") ?? "", /camera=\(\)/);
});

test("HSTS de um ano, sem preload (irreversível; decisão do dono do domínio)", async () => {
  const h = await cabecalhos();
  const hsts = h.get("strict-transport-security") ?? "";
  assert.match(hsts, /max-age=31536000/);
  assert.ok(!/preload/.test(hsts));
});

test("a CSP está em Report-Only, e NÃO em modo de bloqueio ainda", async () => {
  // Aplicar sem medir é a 005 de novo. Quando a lista de violações estiver
  // limpa em produção, troque o nome do cabeçalho E este teste — juntos.
  const h = await cabecalhos();
  assert.ok(h.has("content-security-policy-report-only"));
  assert.ok(!h.has("content-security-policy"), "a CSP foi para bloqueio sem passar pela medição");
});

test("a CSP fecha o que dá para fechar hoje", async () => {
  const csp = (await cabecalhos()).get("content-security-policy-report-only") ?? "";
  for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(csp.includes(d), `faltou ${d}`);
  }
  assert.match(csp, /connect-src[^;]*wss:\/\/\*\.supabase\.co/, "o Realtime do Supabase precisa do wss");
});
