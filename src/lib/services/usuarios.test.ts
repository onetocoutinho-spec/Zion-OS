// Testes do fluxo de criação usuário+perfil (F-01). Puros: validação + orquestração
// com dependências mockadas (sem Supabase real, sem criar usuários de verdade).
// Rodar: node --test src/lib/services/usuarios.test.ts
//
// Cenários 1 (401 não autenticado) e 2 (403 cliente) são garantidos pela camada
// exigirEquipe (ver serverAuthorization.test.ts); aqui cobrimos 3–14.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validarPayloadNovoUsuario,
  criarUsuarioComPerfil,
  type DepsCriacaoUsuario,
} from "./usuarios.ts";

const UUID_A = "a0000000-0000-4000-8000-0000000000a1";

// Fábrica de deps mockadas, com rastreamento de chamadas.
function fabricarDeps(over: Partial<DepsCriacaoUsuario> = {}) {
  const calls = { convidar: 0, criarPerfil: 0, remover: 0 };
  const deps: DepsCriacaoUsuario = {
    empresaExiste: async () => true,
    buscarAuthPorEmail: async () => null,
    convidarAuthUser: async () => {
      calls.convidar++;
      return { id: "novo-user-id" };
    },
    criarPerfil: async () => {
      calls.criarPerfil++;
    },
    removerAuthUser: async () => {
      calls.remover++;
    },
    ...over,
  };
  return { deps, calls };
}

// ---- Validação de payload ----

test("3+8. agência válida (papel equipe) → payload ok", () => {
  const v = validarPayloadNovoUsuario({ nome: "Fulano", email: "A@Zion.COM", papel: "equipe" });
  assert.equal(v.ok, true);
  assert.equal(v.ok && v.dados.email, "a@zion.com"); // normalizado lowercase
  assert.equal(v.ok && v.dados.clienteId, null);
});

test("4. papel inválido → erro de validação", () => {
  const v = validarPayloadNovoUsuario({ nome: "X", email: "x@y.com", papel: "admin" });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.campo, "papel");
});

test("5. e-mail inválido → erro de validação", () => {
  const v = validarPayloadNovoUsuario({ nome: "X", email: "sem-arroba", papel: "equipe" });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.campo, "email");
});

test("6. cliente sem empresa → erro de validação", () => {
  const v = validarPayloadNovoUsuario({ nome: "X", email: "x@y.com", papel: "cliente" });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.campo, "clienteId");
});

test("14. campos privilegiados/desconhecidos são rejeitados", () => {
  for (const extra of ["team_id", "user_id", "ativo", "role", "service_role"]) {
    const v = validarPayloadNovoUsuario({ nome: "X", email: "x@y.com", papel: "equipe", [extra]: "1" });
    assert.equal(v.ok, false, `deveria rejeitar ${extra}`);
    assert.equal(v.ok === false && v.campo, extra);
  }
});

test("nome obrigatório e limite de tamanho", () => {
  assert.equal(validarPayloadNovoUsuario({ nome: "  ", email: "x@y.com", papel: "equipe" }).ok, false);
  assert.equal(validarPayloadNovoUsuario({ nome: "n".repeat(121), email: "x@y.com", papel: "equipe" }).ok, false);
});

test("equipe não pode receber clienteId", () => {
  const v = validarPayloadNovoUsuario({ nome: "X", email: "x@y.com", papel: "equipe", clienteId: UUID_A });
  assert.equal(v.ok, false);
  assert.equal(v.ok === false && v.campo, "clienteId");
});

// ---- Orquestração ----

test("3+8. equipe válida → convidado (Auth + perfil criados)", async () => {
  const { deps, calls } = fabricarDeps();
  const r = await criarUsuarioComPerfil(deps, { nome: "N", email: "e@x.com", papel: "equipe", clienteId: null });
  assert.equal(r.tipo, "convidado");
  assert.equal(calls.convidar, 1);
  assert.equal(calls.criarPerfil, 1);
  assert.equal(calls.remover, 0);
});

test("cliente com empresa válida → convidado", async () => {
  const { deps } = fabricarDeps();
  const r = await criarUsuarioComPerfil(deps, { nome: "N", email: "c@x.com", papel: "cliente", clienteId: UUID_A });
  assert.equal(r.tipo, "convidado");
});

test("7. empresa inexistente/de outro tenant → empresa_invalida (não cria nada)", async () => {
  const { deps, calls } = fabricarDeps({ empresaExiste: async () => false });
  const r = await criarUsuarioComPerfil(deps, { nome: "N", email: "c@x.com", papel: "cliente", clienteId: UUID_A });
  assert.equal(r.tipo, "empresa_invalida");
  assert.equal(calls.convidar, 0);
});

test("9. falha no perfil após Auth → compensação remove o novo usuário", async () => {
  const { deps, calls } = fabricarDeps({
    criarPerfil: async () => {
      throw new Error("db down");
    },
  });
  const r = await criarUsuarioComPerfil(deps, { nome: "N", email: "e@x.com", papel: "equipe", clienteId: null });
  assert.equal(r.tipo, "falha_perfil");
  assert.equal(calls.convidar, 1);
  assert.equal(calls.remover, 1); // compensou removendo o recém-criado
});

test("10. falha na compensação → inconsistente (documentado, com userId)", async () => {
  const { deps } = fabricarDeps({
    criarPerfil: async () => {
      throw new Error("db down");
    },
    removerAuthUser: async () => {
      throw new Error("delete falhou");
    },
  });
  const r = await criarUsuarioComPerfil(deps, { nome: "N", email: "e@x.com", papel: "equipe", clienteId: null });
  assert.equal(r.tipo, "inconsistente");
  assert.equal(r.tipo === "inconsistente" && r.userId, "novo-user-id");
});

test("11+12. e-mail já existente / requisição repetida → ja_existe (não duplica)", async () => {
  const { deps, calls } = fabricarDeps({ buscarAuthPorEmail: async () => ({ id: "existente" }) });
  const r = await criarUsuarioComPerfil(deps, { nome: "N", email: "e@x.com", papel: "equipe", clienteId: null });
  assert.equal(r.tipo, "ja_existe");
  assert.equal(calls.convidar, 0); // não cria segundo usuário
  assert.equal(calls.criarPerfil, 0);
});

test("13. resultado nunca contém segredo (só tipo/userId)", async () => {
  const { deps } = fabricarDeps();
  const r = await criarUsuarioComPerfil(deps, { nome: "N", email: "e@x.com", papel: "equipe", clienteId: null });
  const chaves = Object.keys(r);
  for (const proibida of ["password", "senha", "token", "access_token", "refresh_token", "service_role", "session"]) {
    assert.ok(!chaves.includes(proibida), `resultado não deve conter ${proibida}`);
  }
  assert.deepEqual(chaves.sort(), ["tipo", "userId"]);
});
