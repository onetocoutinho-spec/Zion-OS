// Testes da decisão de rota por papel (Painel da Agência × Portal do Cliente).
// Puros, sem rede/React. Rodar: node --test src/lib/auth/roteamentoPapel.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirRota, estaNoPortalCliente, type PerfilRota } from "./roteamentoPapel.ts";

const equipe: PerfilRota = { papel: "equipe", clienteId: null, ativo: true };
const clienteA: PerfilRota = { papel: "cliente", clienteId: "A", ativo: true };

// ---- estaNoPortalCliente ----

test("estaNoPortalCliente: /cliente e /cliente/* são portal", () => {
  assert.equal(estaNoPortalCliente("/cliente"), true);
  assert.equal(estaNoPortalCliente("/cliente/produtos"), true);
});

test("estaNoPortalCliente: /clientes (lista da equipe) NÃO é portal", () => {
  assert.equal(estaNoPortalCliente("/clientes"), false);
  assert.equal(estaNoPortalCliente("/clientes/123"), false);
});

test("estaNoPortalCliente: rotas da equipe não são portal", () => {
  assert.equal(estaNoPortalCliente("/"), false);
  assert.equal(estaNoPortalCliente("/produtos"), false);
});

// ---- decidirRota: EQUIPE ----

test("equipe em / (e rotas da agência) → ok (fica no Painel da Agência)", () => {
  assert.deepEqual(decidirRota(equipe, "/"), { tipo: "ok" });
  assert.deepEqual(decidirRota(equipe, "/clientes"), { tipo: "ok" });
  assert.deepEqual(decidirRota(equipe, "/vendas"), { tipo: "ok" });
});

test("equipe em /cliente → redireciona para / (não fica preso na casca do cliente)", () => {
  assert.deepEqual(decidirRota(equipe, "/cliente"), { tipo: "redirect", para: "/" });
  assert.deepEqual(decidirRota(equipe, "/cliente/produtos"), { tipo: "redirect", para: "/" });
});

// ---- decidirRota: CLIENTE ----

test("cliente em /cliente/* → ok (fica no Portal do Cliente)", () => {
  assert.deepEqual(decidirRota(clienteA, "/cliente"), { tipo: "ok" });
  assert.deepEqual(decidirRota(clienteA, "/cliente/vendas"), { tipo: "ok" });
});

test("cliente tentando rota da agência → redireciona para /cliente", () => {
  assert.deepEqual(decidirRota(clienteA, "/"), { tipo: "redirect", para: "/cliente" });
  assert.deepEqual(decidirRota(clienteA, "/clientes"), { tipo: "redirect", para: "/cliente" });
  assert.deepEqual(decidirRota(clienteA, "/financeiro"), { tipo: "redirect", para: "/cliente" });
});

// ---- decidirRota: bloqueios ----

test("sem perfil → sem_acesso", () => {
  assert.deepEqual(decidirRota(null, "/"), { tipo: "sem_acesso" });
  assert.deepEqual(decidirRota(null, "/cliente"), { tipo: "sem_acesso" });
});

test("perfil inativo → sem_acesso", () => {
  const inativo: PerfilRota = { papel: "cliente", clienteId: "A", ativo: false };
  assert.deepEqual(decidirRota(inativo, "/cliente"), { tipo: "sem_acesso" });
});

test("cliente sem empresa (clienteId nulo) → sem_acesso", () => {
  const semEmpresa: PerfilRota = { papel: "cliente", clienteId: null, ativo: true };
  assert.deepEqual(decidirRota(semEmpresa, "/cliente"), { tipo: "sem_acesso" });
});
