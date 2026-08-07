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

const equipe: PerfilServidor = { papel: "equipe", clienteId: null, agenciaId: null, ativo: true, nome: "Equipe" };
const clienteA: PerfilServidor = { papel: "cliente", clienteId: "A", agenciaId: null, ativo: true, nome: "Cli A" };
const clienteB: PerfilServidor = { papel: "cliente", clienteId: "B", agenciaId: null, ativo: true, nome: "Cli B" };
const clienteInativo: PerfilServidor = { papel: "cliente", clienteId: "A", agenciaId: null, ativo: false, nome: "Cli A" };

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
  const semEmpresa: PerfilServidor = { papel: "cliente", clienteId: null, agenciaId: null, ativo: true, nome: "" };
  assert.equal(avaliarAcesso({ perfil: semEmpresa, regra: "autenticado", clienteAlvo: "A" }).ok, false);
});

// ---------------------------------------------------------------------------
// A AGÊNCIA SÓ ALCANÇA AS LOJAS DELA — e esta é a única parede
// ---------------------------------------------------------------------------
//
// As rotas que chamam `exigirAcessoAoCliente` seguem usando `service_role`
// depois da checagem, e `service_role` PASSA POR CIMA DO RLS. Então o RLS da
// migração 054 não protege esse caminho: quem protege é `avaliarAcesso`.
//
// Por isso o padrão aqui é NEGAR: `agenciaOperaOCliente` ausente cai no mesmo
// lugar que `false`. Esquecer de perguntar não pode virar permissão.

const AGENCIA = {
  papel: "agencia" as const,
  clienteId: null,
  agenciaId: "ag-1",
  ativo: true,
  nome: "Operador",
};

test("agência com a loja dela: passa", () => {
  const d = avaliarAcesso({
    perfil: AGENCIA,
    regra: "autenticado",
    clienteAlvo: "loja-1",
    agenciaOperaOCliente: true,
  });
  assert.equal(d.ok, true);
});

test("agência com loja de OUTRA agência: 403", () => {
  const d = avaliarAcesso({
    perfil: AGENCIA,
    regra: "autenticado",
    clienteAlvo: "loja-de-outra",
    agenciaOperaOCliente: false,
  });
  assert.equal(d.ok, false);
  assert.equal((d as { status: number }).status, 403);
});

test("NINGUÉM PERGUNTOU: ausente é o mesmo que negado", () => {
  // O caso que mata: uma chamada futura que esqueça de passar o flag. Se o
  // padrão fosse permitir, o esquecimento viraria acesso — e em silêncio.
  const d = avaliarAcesso({ perfil: AGENCIA, regra: "autenticado", clienteAlvo: "loja-1" });
  assert.equal(d.ok, false, "o padrão virou PERMITIR — esquecer de perguntar dá acesso");
});

test("agência NÃO é equipe: a regra `equipe` a recusa", () => {
  // Uma agência é cliente da Zion, não operadora da Zion. Se ela passasse por
  // aqui, alcançaria as rotas administrativas.
  const d = avaliarAcesso({ perfil: AGENCIA, regra: "equipe" });
  assert.equal(d.ok, false);
});

test("agência NÃO é cliente: a regra `cliente` a recusa", () => {
  const d = avaliarAcesso({ perfil: AGENCIA, regra: "cliente" });
  assert.equal(d.ok, false);
});

test("o flag da agência não afeta cliente nem equipe", () => {
  // Ele existe só para o ramo da agência. Um `false` solto não pode fechar a
  // porta de quem já tinha acesso por outro caminho.
  const cliente = { papel: "cliente" as const, clienteId: "loja-1", agenciaId: null, ativo: true, nome: "" };
  const equipe = { papel: "equipe" as const, clienteId: null, agenciaId: null, ativo: true, nome: "" };
  assert.equal(
    avaliarAcesso({ perfil: cliente, regra: "autenticado", clienteAlvo: "loja-1", agenciaOperaOCliente: false }).ok,
    true
  );
  assert.equal(
    avaliarAcesso({ perfil: equipe, regra: "autenticado", clienteAlvo: "loja-9", agenciaOperaOCliente: false }).ok,
    true
  );
});
