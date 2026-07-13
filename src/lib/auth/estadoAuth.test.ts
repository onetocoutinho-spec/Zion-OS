// Testes da máquina de estados de auth/carregamento de perfil (A-01).
// Puros, sem rede/React. Rodar: node --test src/lib/auth/estadoAuth.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirEstadoAuth } from "./estadoAuth.ts";

// 1. sessão restaurando → loading
test("sessão restaurando → restaurando_sessao (loading)", () => {
  assert.equal(decidirEstadoAuth("restaurando", "carregando"), "restaurando_sessao");
  // durante a restauração, a fase do perfil é irrelevante
  assert.equal(decidirEstadoAuth("restaurando", "ok"), "restaurando_sessao");
});

// 2. sem sessão → login
test("sem sessão → sem_sessao (login)", () => {
  assert.equal(decidirEstadoAuth("ausente", "carregando"), "sem_sessao");
});

// 3. sessão válida + perfil carregando → loading
test("sessão presente + perfil carregando → carregando_perfil", () => {
  assert.equal(decidirEstadoAuth("presente", "carregando"), "carregando_perfil");
});

// 4. perfil válido e ativo → autorizado
test("sessão presente + perfil ok → autorizado", () => {
  assert.equal(decidirEstadoAuth("presente", "ok"), "autorizado");
});

// 5. perfil inexistente → acesso não liberado
test("sessão presente + sem perfil → sem_perfil (acesso não liberado)", () => {
  assert.equal(decidirEstadoAuth("presente", "sem_perfil"), "sem_perfil");
});

// 6. perfil inativo → acesso desativado
test("sessão presente + perfil inativo → perfil_inativo (acesso desativado)", () => {
  assert.equal(decidirEstadoAuth("presente", "inativo"), "perfil_inativo");
});

// 7. erro de rede → erro temporário (NÃO acesso negado)
test("sessão presente + erro → erro_perfil (temporário, não nega acesso)", () => {
  assert.equal(decidirEstadoAuth("presente", "erro"), "erro_perfil");
});

// 8. timeout → erro temporário (o timeout produz fasePerfil="erro")
test("timeout (fase perfil = erro) → erro_perfil", () => {
  // o AuthGate classifica timeout como "erro"; a decisão deve ser temporária
  assert.equal(decidirEstadoAuth("presente", "erro"), "erro_perfil");
  assert.notEqual(decidirEstadoAuth("presente", "erro"), "sem_perfil");
});

// 9. retry após erro → volta para loading
test("retry após erro (fase perfil volta a carregando) → carregando_perfil", () => {
  assert.equal(decidirEstadoAuth("presente", "carregando"), "carregando_perfil");
});

// 10. sessão expirada → login
test("sessão expirada (ausente) → sem_sessao (login), nunca acesso negado", () => {
  assert.equal(decidirEstadoAuth("ausente", "erro"), "sem_sessao");
  assert.equal(decidirEstadoAuth("ausente", "ok"), "sem_sessao");
});
