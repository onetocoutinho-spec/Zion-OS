// ZION-INFRA-001 — os cabeçalhos de segurança existem e cobrem tudo.
//
// Em 106f95a `next.config.ts` não tinha `headers()`: sem `frame-ancestors`,
// clickjacking era explorável com um clique. Medido no servidor de dev em
// 21/08/2026 com `curl -sI`: os seis cabeçalhos respondem e a CSP em
// Report-Only não acusou violação nenhuma no dashboard nem no portal.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("a CSP BLOQUEIA, e um Report-Only mais estrito mede a próxima promoção", async () => {
  // Promovida em 21/08/2026 depois de medida em dev e em produção. Os dois
  // cabeçalhos coexistem: o de bloqueio é a política medida; o Report-Only é
  // a mesma sem 'unsafe-inline' em script — a próxima decisão, com dados.
  const h = await cabecalhos();
  const csp = h.get("content-security-policy") ?? "";
  const ro = h.get("content-security-policy-report-only") ?? "";
  assert.ok(csp, "a CSP de bloqueio sumiu");
  assert.match(csp, /script-src [^;]*'unsafe-inline'/, "o Next injeta inline; sem nonce, tirar isto quebra o app");
  assert.ok(!/script-src [^;]*'unsafe-inline'/.test(ro), "o Report-Only deixou de medir a promoção seguinte");
});

test("a CSP carrega o que só a medição em produção revelou", async () => {
  // O domínio está atrás da Cloudflare, que injeta o beacon de Web Analytics.
  // Não está no código; está na resposta. Sem isto, a promoção quebrava o
  // analytics em silêncio — que é exatamente o que a medição existe para pegar.
  const csp = (await cabecalhos()).get("content-security-policy") ?? "";
  assert.ok(/script-src [^;]*https:\/\/static\.cloudflareinsights\.com/.test(csp), "beacon da Cloudflare fora do script-src");
  assert.ok(/connect-src [^;]*https:\/\/static\.cloudflareinsights\.com/.test(csp), "beacon da Cloudflare fora do connect-src");
});

test("as violações vão para um lugar que alguém lê", async () => {
  for (const nome of ["content-security-policy", "content-security-policy-report-only"]) {
    const v = (await cabecalhos()).get(nome) ?? "";
    assert.ok(v.includes("report-uri /api/csp-report"), `${nome} sem report-uri: violação morre no console`);
  }
  const rota = readFileSync(new URL("../src/app/api/csp-report/route.ts", import.meta.url), "utf8");
  assert.ok(rota.includes("csp.violacao"), "a rota precisa logar com a chave que o grep procura");
  assert.match(rota, /TAMANHO_MAXIMO/, "endpoint anônimo sem teto de tamanho");
});

test("a CSP fecha o que dá para fechar hoje", async () => {
  const csp = (await cabecalhos()).get("content-security-policy") ?? "";
  for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(csp.includes(d), `faltou ${d}`);
  }
  assert.match(csp, /connect-src[^;]*wss:\/\/\*\.supabase\.co/, "o Realtime do Supabase precisa do wss");
});

test("'unsafe-eval' nunca entra num deploy — só no next dev local", async () => {
  // O React usa eval() em desenvolvimento e "never in production". Com a
  // política em bloqueio, sem isto o dev quebra; com isto em produção, a CSP
  // deixa de proteger contra o vetor mais clássico. A variável decide.
  const csp = (await cabecalhos()).get("content-security-policy") ?? "";
  if (process.env.VERCEL_ENV) assert.ok(!csp.includes("'unsafe-eval'"), "'unsafe-eval' num deploy");
  else assert.ok(csp.includes("'unsafe-eval'"), "o next dev vai quebrar sem eval");
});
