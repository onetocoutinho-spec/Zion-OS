// ZION-QUOTA-001 / ZION-COST-001 — a cota é cobrada no servidor.
//
// Os dois últimos testes são os que FALHAVAM em 106f95a: as rotas de IA não
// chamavam cota nenhuma.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cobrarCota, decidirCota, type Reservar } from "./cotaDeIA.ts";

const lojista = { perfil: { clienteId: "loja-A" }, usuario: { id: "u1" } } as Parameters<typeof cobrarCota>[0];
const equipe = { perfil: { clienteId: null }, usuario: { id: "u9" } } as Parameters<typeof cobrarCota>[0];

// ---- decidirCota (pura) ----

test("sem cliente_id (equipe/agência) -> libera, sem perguntar ao banco", () => {
  const d = decidirCota({ clienteId: null, reserva: null, falhou: false });
  assert.equal(d.ok, true);
});

test("reserva ok -> libera, com o saldo", () => {
  const d = decidirCota({ clienteId: "A", reserva: { ok: true, limite: 30, usado: 3 }, falhou: false });
  assert.deepEqual(d, { ok: true, limite: 30, usado: 3 });
});

test("cota esgotada -> 429, dizendo quanto", () => {
  const d = decidirCota({ clienteId: "A", reserva: { ok: false, motivo: "cota_esgotada", limite: 30, usado: 30 }, falhou: false });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 429);
  assert.match(d.ok === false ? d.motivo : "", /30\/30/);
});

test("a reserva FALHOU (banco fora, 060 não aplicada) -> NEGA com 503, nunca libera", () => {
  const d = decidirCota({ clienteId: "A", reserva: null, falhou: true });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 503);
});

test("loja que o banco não reconhece -> NEGA (não é 'sem cota')", () => {
  for (const motivo of ["sem_cliente", "cliente_inexistente", "qualquer_outra"]) {
    const d = decidirCota({ clienteId: "A", reserva: { ok: false, motivo }, falhou: false });
    assert.equal(d.ok, false, motivo);
  }
});

// ---- cobrarCota (com a porta injetada) ----

test("cobrarCota chama a reserva com o tenant DA SESSÃO e o usuário", async () => {
  const chamadas: unknown[] = [];
  const reservar: Reservar = async (p) => { chamadas.push(p); return { ok: true, limite: 30, usado: 1 }; };
  const r = await cobrarCota(lojista, "esteira", reservar);
  assert.equal(r.ok, true);
  assert.deepEqual(chamadas, [{ clienteId: "loja-A", tipo: "esteira", creditos: 1, usuarioId: "u1" }]);
});

test("cobrarCota para equipe não toca o banco", async () => {
  let chamou = false;
  const reservar: Reservar = async () => { chamou = true; return { ok: true }; };
  const r = await cobrarCota(equipe, "agente", reservar);
  assert.equal(r.ok, true);
  assert.equal(chamou, false);
});

test("cobrarCota: a porta lança -> 503, e o erro não vaza na mensagem", async () => {
  const reservar: Reservar = async () => { throw new Error("FATAL: password authentication failed for user postgres"); };
  const r = await cobrarCota(lojista, "esteira", reservar);
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.status, 503);
  assert.ok(!(r.ok === false && /postgres|password/.test(r.motivo)));
});

// ---- as rotas — estrutura ----

function rota(rel: string): string {
  return readFileSync(new URL(`../../app/api/${rel}/route.ts`, import.meta.url), "utf8")
    .replace(/^\s*\/\/.*$/gm, "");
}

for (const [nome, tipo] of [["agentes/esteira", "esteira"], ["agentes/executar", "agente"]] as const) {
  test(`/api/${nome} cobra a cota ANTES de chamar o provedor`, () => {
    const f = rota(nome);
    const cobra = f.indexOf(`cobrarCota(ctx, "${tipo}"`);
    const chama = f.indexOf("chamarIAEstruturada(");
    assert.ok(cobra > 0, "a rota não cobra cota");
    assert.ok(chama > 0);
    assert.ok(cobra < chama, "a cota é cobrada depois do provedor — o dinheiro já foi");
    assert.match(f, /if \(!cota\.ok\) return respostaCotaRecusada\(cota\)/);
  });
}

// O chat ficou FORA da cota quando a 060 nasceu — a rota mais cara do produto
// (até seis passos de modelo por turno) sem teto de mês nem de minuto.
test("/api/assistente/conversa cobra a cota ANTES de abrir o fluxo e de chamar o modelo", () => {
  const f = rota("assistente/conversa");
  const cobra = f.indexOf('cobrarCota(ctxAuth, "chat"');
  const fluxo = f.indexOf("new ReadableStream(");
  const chama = f.indexOf("pedirTurnoEmFluxo(");
  assert.ok(cobra > 0, "o chat não cobra cota (ZION-COST-001)");
  assert.ok(fluxo > 0 && chama > 0);
  assert.ok(cobra < fluxo, "a cota é cobrada depois de abrir o fluxo — a resposta já começou");
  assert.ok(cobra < chama, "a cota é cobrada depois do modelo — o dinheiro já foi");
  assert.match(f, /if \(!cota\.ok\) return respostaCotaRecusada\(cota\)/);
  // Falha fechada: sem admin não há como conferir, e sem conferir não responde.
  assert.match(f, /if \(!adminConfigurado\(\)\)[\s\S]{0,200}status: 503/);
});

test("/api/assistente (intenção) cobra a cota antes do classificador", () => {
  const f = rota("assistente");
  const cobra = f.indexOf('cobrarCota(ctx, "intencao"');
  const chama = f.indexOf("chamarIAEstruturada(");
  assert.ok(cobra > 0, "a rota de intenção não cobra cota");
  assert.ok(cobra < chama);
  assert.match(f, /if \(!cota\.ok\) return respostaCotaRecusada\(cota\)/);
});

test("o corpo do chat tem teto: mensagem, número de falas e tamanho total", () => {
  const f = rota("assistente/conversa");
  assert.match(f, /mensagem\.length > MAXIMO_DA_MENSAGEM/);
  // `falas` não vem mais do corpo (o histórico é lido do banco); o teto vale
  // na RELEITURA, para o prompt não crescer sem limite.
  assert.match(f, /slice\(-MAXIMO_DE_FALAS\)/);
  assert.doesNotMatch(f, /corpo\.falas/, "a rota voltou a aceitar o histórico do navegador");
  assert.match(f, /bruto\.length > MAXIMO_DO_CORPO/);
});

test("a migração 060 existe e a reserva é atômica e fechada ao navegador", () => {
  const sql = readFileSync(
    new URL("../../../database/migrations/060-a-cota-de-ia-e-cobrada-no-servidor.sql", import.meta.url),
    "utf8"
  ).replace(/^\s*--.*$/gm, "");
  assert.match(sql, /create or replace function public\.reservar_cota_ia/i);
  assert.match(sql, /for update/i, "sem lock na linha do cliente, a cota vira sugestão sob concorrência");
  assert.match(sql, /revoke execute on function public\.reservar_cota_ia[\s\S]*?from public, anon, authenticated/i);
  assert.match(sql, /quota_esteira\(\)[\s\S]*?consumo_ia/i, "quota_esteira precisa olhar o mesmo ledger");
});

test("/api/catalogo/extrair cobra a cota antes de subir o arquivo — e só na extração de verdade", () => {
  const f = rota("catalogo/extrair");
  const cobra = f.indexOf('cobrarCota(ctx, "catalogo"');
  const sobe = f.indexOf("enviarPdfParaIA(");
  assert.ok(cobra > 0, "a extração de catálogo não cobra cota (ZION-COST-001)");
  assert.ok(cobra < sobe, "cobra depois de subir 500 MB — a banda já foi");
  // medir=1 não custa: a condição precisa excluir o modo de medição.
  assert.match(f, /if \(!apenasMedir && ctx\.perfil\.clienteId\)/);
});

test("ritmo (063): 429 sem mencionar cota esgotada — o mês ainda tem crédito", () => {
  const d = decidirCota({ clienteId: "A", reserva: { ok: false, motivo: "ritmo", limite: 30, usado: 3 }, falhou: false });
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 429);
  assert.match(d.ok === false ? d.motivo : "", /minuto/);
  assert.ok(!/esgotada/.test(d.ok === false ? d.motivo : ""));
});
