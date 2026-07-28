// Testes do provisionamento da loja.
//
// É a porta de entrada do SaaS: quem passa por aqui vira dono de uma base.
// Rodar: npx tsx --test src/modules/onboarding/domain/criacaoDeLoja.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { decidirProvisionamento, validarPedidoDeLoja } from "./criacaoDeLoja.ts";

// ---- Validação do pedido ----

test("aceita um nome de loja normal", () => {
  const r = validarPedidoDeLoja({ nomeDaLoja: "  Chinelaria Leilane  " });
  assert.ok(r.ok);
  assert.equal(r.nomeDaLoja, "Chinelaria Leilane");
});

test("RECUSA qualquer campo além do nome da loja", () => {
  // A lista fechada é a defesa que importa: um provisionamento que aceita
  // campos extras aceita `papel:"equipe"` no dia em que alguém tentar — e essa
  // é a diferença entre um cliente novo e um invasor com acesso total.
  for (const extra of [
    { nomeDaLoja: "Loja", papel: "equipe" },
    { nomeDaLoja: "Loja", clienteId: "00000000-0000-4000-8000-000000000000" },
    { nomeDaLoja: "Loja", plano: "enterprise" },
    { nomeDaLoja: "Loja", limiteEsteiraMes: 999999 },
  ]) {
    const r = validarPedidoDeLoja(extra);
    assert.equal(r.ok, false, `deveria recusar ${JSON.stringify(extra)}`);
  }
});

test("nome vazio, só espaços ou curto demais não passa", () => {
  for (const v of [{ nomeDaLoja: "" }, { nomeDaLoja: "   " }, { nomeDaLoja: "A" }]) {
    const r = validarPedidoDeLoja(v);
    assert.equal(r.ok, false);
    assert.ok(!r.ok && r.campo === "nomeDaLoja");
  }
});

test("nome absurdamente longo não passa — campo sem teto é convite a abuso", () => {
  const r = validarPedidoDeLoja({ nomeDaLoja: "x".repeat(500) });
  assert.equal(r.ok, false);
});

test("payload que não é objeto não derruba nada", () => {
  for (const v of [null, undefined, "texto", 42, []]) {
    assert.equal(validarPedidoDeLoja(v).ok, false);
  }
});

// ---- Decisão ----

test("usuário sem perfil ganha loja", () => {
  assert.deepEqual(decidirProvisionamento({ temPerfil: false }), { acao: "provisionar" });
});

test("chamar duas vezes NÃO cria duas lojas", () => {
  // O navegador repete: recarregou, clicou duas vezes, a rede engasgou. Duas
  // lojas para a mesma pessoa deixariam ela com duas bases e nenhuma completa.
  const r = decidirProvisionamento({ temPerfil: true, papelExistente: "cliente" });
  assert.equal(r.acao, "ja_provisionado");
});

test("conta de EQUIPE não vira dona de loja por engano", () => {
  const r = decidirProvisionamento({ temPerfil: true, papelExistente: "equipe" });
  assert.equal(r.acao, "recusar");
  assert.ok(r.acao === "recusar" && r.motivo.length > 10);
});
