// Testes da decisão de rota por papel (Painel da Agência × Portal do Cliente).
// Puros, sem rede/React. Rodar: node --test src/lib/auth/roteamentoPapel.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirRota, estaNoPortalCliente, lerPapel, type PerfilRota } from "./roteamentoPapel.ts";

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

// ---------------------------------------------------------------------------
// O PAPEL QUE NÃO SE RECONHECE NÃO VIRA O MAIS PRIVILEGIADO
// ---------------------------------------------------------------------------
//
// Os dois lugares que liam o papel faziam `papel === "cliente" ? "cliente" :
// "equipe"`. Qualquer outra coisa — um papel novo, um erro de digitação, uma
// string vazia — virava EQUIPE. Falha aberta, e no lugar mais caro para falhar
// aberto: `avaliarAcesso` libera equipe para qualquer `clienteAlvo`, e as rotas
// que chamam isso seguem com `service_role`, que passa por cima do RLS.

test("os três papéis conhecidos são lidos como eles mesmos", () => {
  assert.equal(lerPapel("cliente"), "cliente");
  assert.equal(lerPapel("equipe"), "equipe");
  assert.equal(lerPapel("agencia"), "agencia");
});

test("o que não se reconhece vira null — nunca equipe", () => {
  // A lista é de casos reais de como um papel errado chega: plural, maiúscula,
  // vazio, nulo, e o tipo errado vindo de um JSON.
  for (const bruto of ["clientes", "Cliente", "EQUIPE", "", " cliente", "admin", null, undefined, 0, {}, ["equipe"]]) {
    assert.equal(
      lerPapel(bruto),
      null,
      `${JSON.stringify(bruto)} foi aceito — e o padrão antigo o teria lido como "equipe"`
    );
  }
});

// ---------------------------------------------------------------------------
// A AGÊNCIA MORA NO PAINEL, NÃO NO PORTAL
// ---------------------------------------------------------------------------

test("agência fora do portal segue; dentro do portal é mandada para o painel", () => {
  const agencia = { papel: "agencia" as const, clienteId: null, agenciaId: "ag-1" };
  assert.deepEqual(decidirRota(agencia, "/clientes"), { tipo: "ok" });
  assert.deepEqual(decidirRota(agencia, "/esteira"), { tipo: "ok" });
  assert.deepEqual(decidirRota(agencia, "/cliente"), { tipo: "redirect", para: "/" });
  assert.deepEqual(decidirRota(agencia, "/cliente/produtos"), { tipo: "redirect", para: "/" });
});

test("agência SEM vínculo é perfil incompleto — pela mesma razão que cliente sem empresa", () => {
  const semVinculo = { papel: "agencia" as const, clienteId: null, agenciaId: null };
  assert.deepEqual(decidirRota(semVinculo, "/clientes"), { tipo: "sem_acesso" });
  assert.deepEqual(decidirRota(semVinculo, "/cliente"), { tipo: "sem_acesso" });
});

test("a agência inativa não entra, como qualquer outro papel", () => {
  assert.deepEqual(
    decidirRota({ papel: "agencia", clienteId: null, agenciaId: "ag-1", ativo: false }, "/clientes"),
    { tipo: "sem_acesso" }
  );
});
