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

test("equipe em /cliente → ok: OPERA a loja do contexto (fatia 5)", () => {
  // Até a fatia 5 a equipe era expulsa do portal — ela via a casca do lojista
  // com loja nula. Agora a casca resolve a loja pelo contexto global e mostra
  // a barra "Operando"; sem loja, pede para escolher. Ver ClientPortalShell.
  assert.deepEqual(decidirRota(equipe, "/cliente"), { tipo: "ok" });
  assert.deepEqual(decidirRota(equipe, "/cliente/produtos"), { tipo: "ok" });
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

test("agência segue no painel E entra no portal para operar a loja do contexto", () => {
  const agencia = { papel: "agencia" as const, clienteId: null, agenciaId: "ag-1" };
  assert.deepEqual(decidirRota(agencia, "/clientes"), { tipo: "ok" });
  assert.deepEqual(decidirRota(agencia, "/esteira"), { tipo: "ok" });
  assert.deepEqual(decidirRota(agencia, "/cliente"), { tipo: "ok" });
  assert.deepEqual(decidirRota(agencia, "/cliente/produtos"), { tipo: "ok" });
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

// ---------------------------------------------------------------------------
// A ATERRISSAGEM DO OAUTH É A ÚNICA EXCEÇÃO
// ---------------------------------------------------------------------------
//
// O `redirect_uri` registrado no app do Mercado Livre é UM endereço só, e ele
// mora sob `/cliente/`. Se a agência for expulsa dessa página, o ML devolve o
// código para uma tela que redireciona antes de consumi-lo — e a conexão morre
// no meio, sem erro visível.

test("a agência ENTRA na página de conexão do marketplace", () => {
  const agencia = { papel: "agencia" as const, clienteId: null, agenciaId: "ag-1" };
  assert.deepEqual(decidirRota(agencia, "/cliente/conectar-ml"), { tipo: "ok" });
});

test("e o resto do portal também abre — é a MESMA casca, com a loja do contexto", () => {
  // Antes a exceção era de UMA rota (o OAuth). Agora o portal inteiro é a
  // Store experience de quem opera; a segurança continua no RLS e no portão
  // loja_em_operacao() (migração 064), não neste redirecionamento.
  const agencia = { papel: "agencia" as const, clienteId: null, agenciaId: "ag-1" };
  for (const rota of ["/cliente", "/cliente/produtos", "/cliente/vendas", "/cliente/conectar-ml/x"]) {
    assert.deepEqual(decidirRota(agencia, rota), { tipo: "ok" }, `${rota} fechou para a agência`);
  }
});

test("a exceção NÃO abre a porta para quem não tem vínculo", () => {
  assert.deepEqual(
    decidirRota({ papel: "agencia", clienteId: null, agenciaId: null }, "/cliente/conectar-ml"),
    { tipo: "sem_acesso" }
  );
});

test("a lojista continua entrando na mesma página, como sempre", () => {
  assert.deepEqual(
    decidirRota({ papel: "cliente", clienteId: "loja-1" }, "/cliente/conectar-ml"),
    { tipo: "ok" }
  );
});

test("a equipe também conecta o marketplace de uma loja pelo portal", () => {
  assert.deepEqual(
    decidirRota({ papel: "equipe", clienteId: null }, "/cliente/conectar-ml"),
    { tipo: "ok" }
  );
});

// ---------------------------------------------------------------------------
// OFERECER ≠ ENTREGAR — também pela URL (fatia 3, docs/product/ux/02 P1)
// ---------------------------------------------------------------------------

test("agência digitando rota da Zion recebe 'proibido' — nunca tela vazia", () => {
  const agencia = { papel: "agencia" as const, clienteId: null, agenciaId: "ag-1" };
  for (const rota of ["/agentes", "/ail/padroes", "/ail/inteligencia", "/templates", "/configuracoes", "/usuarios/novo", "/z"]) {
    assert.deepEqual(decidirRota(agencia, rota), { tipo: "proibido" }, `${rota} abriu para a agência`);
  }
});

test("agência alcança o que opera, inclusive detalhe e busca", () => {
  const agencia = { papel: "agencia" as const, clienteId: null, agenciaId: "ag-1" };
  for (const rota of ["/", "/clientes", "/clientes/abc", "/produtos/xyz/editar", "/esteira/lote", "/fila-otimizacao", "/otimizar-lote", "/vendas", "/busca"]) {
    assert.deepEqual(decidirRota(agencia, rota), { tipo: "ok" }, `${rota} fechou para a agência`);
  }
});

test("equipe alcança tudo, inclusive /z", () => {
  for (const rota of ["/", "/agentes", "/z", "/clientes/abc"]) {
    assert.deepEqual(decidirRota(equipe, rota), { tipo: "ok" });
  }
});
