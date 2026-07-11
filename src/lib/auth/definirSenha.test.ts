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

// ---- redirectTo seguro (impede open redirect / domínio arbitrário) ----

test("redirectTo usa a origin da env + rota fixa", () => {
  assert.equal(
    montarRedirectConvite("https://exemplo-preview.vercel.app"),
    "https://exemplo-preview.vercel.app/definir-senha"
  );
});

test("redirectTo ignora path/query arbitrário da env (só origin)", () => {
  assert.equal(
    montarRedirectConvite("https://exemplo.app/qualquer?x=1#y"),
    "https://exemplo.app/definir-senha"
  );
});

test("redirectTo rejeita env vazia/ausente → null (usa Site URL do Supabase)", () => {
  assert.equal(montarRedirectConvite(undefined), null);
  assert.equal(montarRedirectConvite(""), null);
});

test("redirectTo rejeita URL inválida ou esquema não-http(s) → null", () => {
  assert.equal(montarRedirectConvite("javascript:alert(1)"), null);
  assert.equal(montarRedirectConvite("nao-e-url"), null);
  assert.equal(montarRedirectConvite("ftp://x.y"), null);
});
