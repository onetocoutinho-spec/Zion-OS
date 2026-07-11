// Testes do fluxo "definir senha do convite" (puros).
// Rodar: node --test src/lib/auth/definirSenha.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { validarNovaSenha, destinoAposSenha, montarRedirectConvite } from "./definirSenha.ts";

// ---- validação de senha ----

test("senha curta (< 8) → erro", () => {
  const v = validarNovaSenha("1234567", "1234567");
  assert.equal(v.ok, false);
});

test("confirmação diferente → erro", () => {
  const v = validarNovaSenha("senhaForte1", "outraCoisa1");
  assert.equal(v.ok, false);
});

test("senha válida e confirmada → ok", () => {
  assert.equal(validarNovaSenha("senhaForte1", "senhaForte1").ok, true);
});

// ---- destino após sucesso ----

test("equipe → redireciona para /", () => {
  assert.equal(destinoAposSenha("equipe"), "/");
  assert.equal(destinoAposSenha(null), "/"); // fallback seguro
  assert.equal(destinoAposSenha(undefined), "/");
});

test("cliente → redireciona para /cliente", () => {
  assert.equal(destinoAposSenha("cliente"), "/cliente");
});

// ---- redirectTo seguro (APP_URL server-side; impede open redirect) ----

test("APP_URL válida (https) gera exatamente ${origin}/definir-senha", () => {
  const r = montarRedirectConvite("https://exemplo-preview.vercel.app");
  assert.equal(r, "https://exemplo-preview.vercel.app/definir-senha");
  assert.ok(r !== null && r.endsWith("/definir-senha"));
});

test("barra final da APP_URL é normalizada", () => {
  assert.equal(montarRedirectConvite("https://exemplo.app/"), "https://exemplo.app/definir-senha");
});

test("path/query/fragment da APP_URL são ignorados (só a origin)", () => {
  assert.equal(
    montarRedirectConvite("https://exemplo.app/qualquer?x=1#y"),
    "https://exemplo.app/definir-senha"
  );
});

test("protocolo javascript: é rejeitado → null", () => {
  assert.equal(montarRedirectConvite("javascript:alert(1)"), null);
});

test("protocolo http:// é rejeitado (só https em Preview/Production) → null", () => {
  assert.equal(montarRedirectConvite("http://exemplo.app"), null);
  assert.equal(montarRedirectConvite("http://localhost:3000"), null);
});

test("APP_URL ausente/vazia → null (o handler recusa o convite; não usa Site URL)", () => {
  assert.equal(montarRedirectConvite(undefined), null);
  assert.equal(montarRedirectConvite(null), null);
  assert.equal(montarRedirectConvite(""), null);
});

test("APP_URL inválida (não é URL / esquema ftp) → null (impede criação no Auth)", () => {
  assert.equal(montarRedirectConvite("nao-e-url"), null);
  assert.equal(montarRedirectConvite("ftp://x.y"), null);
});

test("retorno é sempre string OU null (nunca undefined) → redirectTo nunca undefined", () => {
  for (const s of ["https://a.app", "http://a.app", "", undefined, null, "lixo"]) {
    const r = montarRedirectConvite(s as string | null | undefined);
    assert.ok(r === null || typeof r === "string");
    assert.notEqual(r, undefined);
  }
});

test("domínio extra (ex.: vindo do payload) é ignorado — usa só a APP_URL", () => {
  // @ts-expect-error a função aceita só 1 argumento; um 2º é ignorado pelo JS
  assert.equal(montarRedirectConvite("https://a.app", "https://evil.com/x"), "https://a.app/definir-senha");
});
