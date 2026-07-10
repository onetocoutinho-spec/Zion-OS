// Testes das funções PURAS de autorização (R1/R6).
//
// Não dependem de rede/Supabase — cobrem a decisão de acesso, que é o coração
// da segurança multiempresa. Rodar com o runner nativo do Node (v22+/v24):
//
//   node --test src/lib/auth/serverAuthorization.test.ts
//
// (Node executa TypeScript nativamente por type-stripping.)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lerTokenBearer,
  avaliarAcesso,
  type PerfilServidor,
} from "./serverAuthorization.ts";

const equipe: PerfilServidor = { papel: "equipe", clienteId: null, ativo: true, nome: "Equipe" };
const clienteA: PerfilServidor = { papel: "cliente", clienteId: "A", ativo: true, nome: "Cli A" };
const clienteB: PerfilServidor = { papel: "cliente", clienteId: "B", ativo: true, nome: "Cli B" };
const clienteInativo: PerfilServidor = { papel: "cliente", clienteId: "A", ativo: false, nome: "Cli A" };

// ---- lerTokenBearer ----

test("lerTokenBearer: header ausente -> null", () => {
  assert.equal(lerTokenBearer(null), null);
  assert.equal(lerTokenBearer(undefined), null);
  assert.equal(lerTokenBearer(""), null);
});

test("lerTokenBearer: extrai o token de 'Bearer <jwt>'", () => {
  assert.equal(lerTokenBearer("Bearer abc.def.ghi"), "abc.def.ghi");
});

test("lerTokenBearer: aceita 'bearer' minúsculo e espaços em volta", () => {
  assert.equal(lerTokenBearer("  bearer   tok123  "), "tok123");
});

test("lerTokenBearer: esquema não-Bearer -> null", () => {
  assert.equal(lerTokenBearer("Basic abc"), null);
  assert.equal(lerTokenBearer("Bearer"), null);
  assert.equal(lerTokenBearer("Bearer    "), null);
});

// ---- avaliarAcesso ----

test("sem perfil (autenticado sem cadastro) -> 403", () => {
  const d = avaliarAcesso({ perfil: null, regra: "autenticado" });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 403);
});

test("perfil inativo -> 403", () => {
  const d = avaliarAcesso({ perfil: clienteInativo, regra: "autenticado" });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 403);
});

test("regra 'equipe' exige papel equipe", () => {
  assert.equal(avaliarAcesso({ perfil: equipe, regra: "equipe" }).ok, true);
  const neg = avaliarAcesso({ perfil: clienteA, regra: "equipe" });
  assert.equal(neg.ok, false);
  assert.equal(neg.ok === false && neg.status, 403);
});

test("regra 'cliente' exige papel cliente", () => {
  assert.equal(avaliarAcesso({ perfil: clienteA, regra: "cliente" }).ok, true);
  assert.equal(avaliarAcesso({ perfil: equipe, regra: "cliente" }).ok, false);
});

test("regra 'autenticado' com perfil ativo -> ok", () => {
  assert.equal(avaliarAcesso({ perfil: equipe, regra: "autenticado" }).ok, true);
  assert.equal(avaliarAcesso({ perfil: clienteA, regra: "autenticado" }).ok, true);
});

test("acesso a cliente: equipe acessa QUALQUER cliente", () => {
  assert.equal(avaliarAcesso({ perfil: equipe, regra: "autenticado", clienteAlvo: "A" }).ok, true);
  assert.equal(avaliarAcesso({ perfil: equipe, regra: "autenticado", clienteAlvo: "B" }).ok, true);
});

test("acesso a cliente: cliente A acessa A, NÃO acessa B", () => {
  assert.equal(avaliarAcesso({ perfil: clienteA, regra: "autenticado", clienteAlvo: "A" }).ok, true);
  const neg = avaliarAcesso({ perfil: clienteA, regra: "autenticado", clienteAlvo: "B" });
  assert.equal(neg.ok, false);
  assert.equal(neg.ok === false && neg.status, 403);
});

test("acesso a cliente: cliente B NÃO acessa A", () => {
  assert.equal(avaliarAcesso({ perfil: clienteB, regra: "autenticado", clienteAlvo: "A" }).ok, false);
});

test("acesso a cliente: cliente sem clienteId nunca casa alvo", () => {
  const semEmpresa: PerfilServidor = { papel: "cliente", clienteId: null, ativo: true, nome: "" };
  assert.equal(avaliarAcesso({ perfil: semEmpresa, regra: "autenticado", clienteAlvo: "A" }).ok, false);
});
