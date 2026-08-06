// Testes da decisão de rota por papel (Painel da Agência × Portal do Cliente).
// Puros, sem rede/React. Rodar: node --test src/lib/auth/roteamentoPapel.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decidirRota,
  estaNoPortalCliente,
  ENTRADA_DA_EQUIPE,
  type PerfilRota,
} from "./roteamentoPapel.ts";

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

test("equipe nas rotas da equipe → ok", () => {
  assert.deepEqual(decidirRota(equipe, "/clientes"), { tipo: "ok" });
  assert.deepEqual(decidirRota(equipe, "/configuracoes"), { tipo: "ok" });
  assert.deepEqual(decidirRota(equipe, "/ail/padroes"), { tipo: "ok" });
});

test("equipe na RAIZ → vai para a entrada, porque a raiz não tem tela", () => {
  // O painel da agência morava em "/" e saiu com o modelo de agência
  // (PLANO-003). A tentativa anterior foi um `redirect()` na própria página,
  // que NÃO dispara: medido no log, `GET / 200` sempre, porque o `AuthGate` é
  // client e os filhos não chegam a ser avaliados quando ele mostra o login.
  assert.deepEqual(decidirRota(equipe, "/"), {
    tipo: "redirect",
    para: ENTRADA_DA_EQUIPE,
  });
});

test("equipe em /cliente → sai da casca do cliente pela mesma porta", () => {
  // Um destino só para os dois casos: se a entrada mudar, muda nos dois.
  assert.deepEqual(decidirRota(equipe, "/cliente"), {
    tipo: "redirect",
    para: ENTRADA_DA_EQUIPE,
  });
  assert.deepEqual(decidirRota(equipe, "/cliente/produtos"), {
    tipo: "redirect",
    para: ENTRADA_DA_EQUIPE,
  });
});

test("a entrada da equipe é uma rota que existe", () => {
  // Guarda o defeito exato que este bloco corrige: apontar a entrada para uma
  // tela apagada. "/" deixou de ter conteúdo, e a raiz não pode ser destino.
  assert.notEqual(ENTRADA_DA_EQUIPE, "/");
  assert.match(ENTRADA_DA_EQUIPE, /^\/[a-z]/);
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
