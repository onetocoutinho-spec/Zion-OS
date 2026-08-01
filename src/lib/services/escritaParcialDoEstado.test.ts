// Uma falha parcial de rede não pode custar as gravações que deram certo.
//
// ===========================================================================
// OBSERVADO EM PRODUÇÃO, 2026-08-01
// ===========================================================================
//
//   [Zion OS] Erro ao atualizar registros em anuncios_gerados no Supabase:
//   TypeError: Failed to fetch
//
// Estado do banco DEPOIS do erro:
//
//     active        546   ✓ gravou
//     under_review  155   ✓ gravou
//     paused         66   ✓ gravou
//     closed         12   ✗
//     inactive        2   ✗
//
// Os dois que falharam são os MENORES lotes — os de 200 UUIDs passaram e os de
// 12 e 2 não. Tamanho de requisição está DESCARTADO como causa. A causa raiz
// continua NÃO ESTABELECIDA.
//
// O que está estabelecido é o custo: `atualizarVarios` lança no primeiro lote
// que desiste, então 14 linhas derrubaram a importação inteira e o usuário viu
// um erro por cima de 767 gravações bem-sucedidas.
//
// Estes testes protegem o comportamento sob falha, não a causa dela.

import test from "node:test";
import assert from "node:assert/strict";
import { estadosDesatualizados } from "../../modules/integration/domain/estadoNoMarketplaceDesatualizado.ts";

const AGORA = "2026-08-01T20:00:00.000Z";
const DEPOIS = "2026-08-01T21:00:00.000Z";

test("reexecutar só escreve o que faltou — o segundo clique é barato e seguro", () => {
  // O cenário real: 767 gravaram, 14 não. Na segunda tentativa, só os 14
  // aparecem, porque `estadosDesatualizados` compara com o que está gravado.
  const conhecidos = [
    { id: "a1", mlItemId: "MLB1", statusMarketplace: "active" }, // gravou
    { id: "a2", mlItemId: "MLB2", statusMarketplace: "under_review" }, // gravou
    { id: "a3", mlItemId: "MLB3", statusMarketplace: null }, // falhou
    { id: "a4", mlItemId: "MLB4", statusMarketplace: null }, // falhou
  ];
  const lidos = [
    { mlb: "MLB1", status: "active" },
    { mlb: "MLB2", status: "under_review" },
    { mlb: "MLB3", status: "closed" },
    { mlb: "MLB4", status: "inactive" },
  ];
  const r = estadosDesatualizados(conhecidos, lidos, DEPOIS);
  assert.deepEqual(
    r.map((x) => x.id),
    ["a3", "a4"],
    "reescreveu linhas que já estavam certas"
  );
});

test("quem gravou na primeira não tem a data reescrita na segunda", () => {
  // Se a reexecução regravasse tudo, `status_marketplace_em` passaria a dizer
  // que aprendemos `active` às 21h, quando aprendemos às 20h.
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: "active" }],
    [{ mlb: "MLB1", status: "active" }],
    DEPOIS
  );
  assert.deepEqual(r, [], `a data de a1 seria sobrescrita com ${DEPOIS}`);
});

test("a segunda tentativa converge: nada sobra para uma terceira", () => {
  const lidos = [
    { mlb: "MLB1", status: "closed" },
    { mlb: "MLB2", status: "inactive" },
  ];
  const primeira = estadosDesatualizados(
    [
      { id: "a1", mlItemId: "MLB1", statusMarketplace: null },
      { id: "a2", mlItemId: "MLB2", statusMarketplace: null },
    ],
    lidos,
    AGORA
  );
  assert.equal(primeira.length, 2);

  // Aplicando o que a primeira produziu, a segunda não acha nada.
  const depoisDeAplicar = primeira.map((p) => ({
    id: p.id,
    mlItemId: p.id === "a1" ? "MLB1" : "MLB2",
    statusMarketplace: p.statusMarketplace,
  }));
  assert.deepEqual(estadosDesatualizados(depoisDeAplicar, lidos, DEPOIS), []);
});

test("falha parcial não muda o que o ML disse — a próxima leitura decide de novo", () => {
  // Se entre as duas tentativas o anúncio voltar ao ar, a segunda grava
  // `active`, não o `closed` que falhou. Nada da tentativa perdida fica preso.
  const r = estadosDesatualizados(
    [{ id: "a1", mlItemId: "MLB1", statusMarketplace: null }],
    [{ mlb: "MLB1", status: "active" }],
    DEPOIS
  );
  assert.equal(r[0].statusMarketplace, "active");
});
