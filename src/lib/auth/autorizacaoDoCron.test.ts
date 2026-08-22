// ZION-CRON-001 — o worker nega quando não sabe quem pode chamá-lo.
//
// O primeiro teste é o que FALHAVA em 106f95a: a função antiga devolvia
// `true` sem segredo, em qualquer ambiente.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decidirAcessoDoCron } from "./autorizacaoDoCron.ts";

const SEGREDO = "s3gr3do-de-teste-longo-o-suficiente";

test("na Vercel, sem CRON_SECRET -> NEGA (503), mesmo sem header", () => {
  const d = decidirAcessoDoCron({ authorization: null, segredo: undefined, vercelEnv: "production" });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 503);
});

test("na Vercel, sem CRON_SECRET -> NEGA mesmo com um Bearer qualquer", () => {
  // Antes: `if (!secret) return true` — o header nem era olhado.
  const d = decidirAcessoDoCron({ authorization: "Bearer tanto-faz", segredo: "", vercelEnv: "preview" });
  assert.equal(d.ok, false);
});

test("preview também é produção para este fim", () => {
  const d = decidirAcessoDoCron({ authorization: null, segredo: undefined, vercelEnv: "preview" });
  assert.equal(d.ok, false);
});

test("dev local (sem VERCEL_ENV), sem segredo -> libera", () => {
  const d = decidirAcessoDoCron({ authorization: null, segredo: undefined, vercelEnv: undefined });
  assert.equal(d.ok, true);
});

test("com segredo: Bearer correto -> ok", () => {
  const d = decidirAcessoDoCron({ authorization: `Bearer ${SEGREDO}`, segredo: SEGREDO, vercelEnv: "production" });
  assert.equal(d.ok, true);
});

test("com segredo: Bearer errado -> 401", () => {
  const d = decidirAcessoDoCron({ authorization: `Bearer ${SEGREDO}x`, segredo: SEGREDO, vercelEnv: "production" });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 401);
});

test("com segredo: header ausente, prefixo errado, ou só o segredo sem 'Bearer ' -> 401", () => {
  for (const h of [null, "", "Basic x", SEGREDO, `bearer ${SEGREDO}`]) {
    const d = decidirAcessoDoCron({ authorization: h, segredo: SEGREDO, vercelEnv: "production" });
    assert.equal(d.ok, false, `aceitou header ${JSON.stringify(h)}`);
  }
});

test("com segredo, em dev local, ainda exige o Bearer", () => {
  // Definir a variável localmente é pedir a checagem. Não se perde a checagem
  // por estar fora da Vercel.
  const d = decidirAcessoDoCron({ authorization: null, segredo: SEGREDO, vercelEnv: undefined });
  assert.equal(d.ok, false);
});

test("a comparação é em tempo constante", () => {
  const fonte = readFileSync(new URL("./autorizacaoDoCron.ts", import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.match(fonte, /timingSafeEqual/);
  assert.ok(!/===\s*`Bearer/.test(fonte), "voltou a comparar o segredo com ===");
});

test("a rota do worker usa a decisão pura, e não reimplementa", () => {
  const rota = readFileSync(
    new URL("../../app/api/otimizar/worker/route.ts", import.meta.url),
    "utf8"
  ).replace(/^\s*\/\/.*$/gm, "");
  assert.match(rota, /decidirAcessoDoCron\(/);
  assert.ok(!/if\s*\(\s*!secret\s*\)\s*return\s+true/.test(rota), "o fail-open voltou para a rota");
});

test("CRON_SECRET está documentada no .env.example, e como server-only", () => {
  // O finding nasceu aqui: a variável só existia no exemplo de STAGING. Quem
  // provisionava produção a partir do .env.example subia sem ela.
  const env = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
  assert.match(env, /^CRON_SECRET=/m, "CRON_SECRET sumiu do .env.example");
  assert.ok(!/NEXT_PUBLIC_CRON_SECRET/.test(env));
});
