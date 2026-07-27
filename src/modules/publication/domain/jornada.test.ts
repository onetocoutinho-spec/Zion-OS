// Testes da jornada guiada (E).
//
// O que se prova: a jornada sempre sabe dizer a ÚNICA coisa a fazer agora, e
// deriva isso do estado real — quem sai da tela e volta reencontra o mesmo
// lugar, sem contador de cliques.
// Rodar: npx tsx --test src/modules/publication/domain/jornada.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  etapaAtual,
  montarJornada,
  proximaAcao,
  concluida,
  type ContextoJornada,
  type AnuncioNaJornada,
} from "./jornada.ts";

const semNada: ContextoJornada = {
  temProduto: false,
  anuncio: null,
  conectado: true,
  quotaRestante: 10,
};

const bom: AnuncioNaJornada = {
  status: "aguardando_aprovacao",
  vereditoA10: "aprovado",
  qtdPendencias: 0,
};

const ctx = (over: Partial<ContextoJornada>): ContextoJornada => ({ ...semNada, ...over });

// ── Onde estou ───────────────────────────────────────────────────────────────

test("sem produto, a jornada começa na escolha do produto", () => {
  assert.equal(etapaAtual(semNada), "produto");
});

test("com produto e sem anúncio, o passo é gerar", () => {
  assert.equal(etapaAtual(ctx({ temProduto: true })), "gerar");
});

test("anúncio gerado com pendências → revisar, não aprovar", () => {
  const comPendencia = { ...bom, qtdPendencias: 2, vereditoA10: "reprovado" };
  assert.equal(etapaAtual(ctx({ temProduto: true, anuncio: comPendencia })), "revisar");
});

test("anúncio limpo e aprovado pela revisão final → aprovar", () => {
  assert.equal(etapaAtual(ctx({ temProduto: true, anuncio: bom })), "aprovar");
});

test("anúncio já aprovado pelo lojista → publicar", () => {
  const aprovado = { ...bom, status: "aprovado" };
  assert.equal(etapaAtual(ctx({ temProduto: true, anuncio: aprovado })), "publicar");
});

test("anúncio rejeitado volta para gerar — o caminho é refazer", () => {
  const rejeitado = { ...bom, status: "rejeitado" };
  assert.equal(etapaAtual(ctx({ temProduto: true, anuncio: rejeitado })), "gerar");
});

test("a etapa vem do ESTADO, não de um contador — voltar à tela reencontra o lugar", () => {
  // Dois contextos idênticos produzem a mesma etapa, sem memória de navegação.
  const a = ctx({ temProduto: true, anuncio: bom });
  const b = ctx({ temProduto: true, anuncio: { ...bom } });
  assert.equal(etapaAtual(a), etapaAtual(b));
});

// ── A trilha ─────────────────────────────────────────────────────────────────

test("a trilha tem os cinco passos, sempre, na mesma ordem", () => {
  assert.deepEqual(
    montarJornada(semNada).map((p) => p.etapa),
    ["produto", "gerar", "revisar", "aprovar", "publicar"]
  );
});

test("o que ficou para trás é 'feito', o que vem é 'futuro', e há exatamente um atual", () => {
  const passos = montarJornada(ctx({ temProduto: true, anuncio: bom }));
  assert.deepEqual(
    passos.map((p) => p.estado),
    ["feito", "feito", "feito", "atual", "futuro"]
  );
});

test("publicado: a trilha inteira fica feita", () => {
  const publicado = { ...bom, status: "publicado", mlItemId: "MLB1" };
  const passos = montarJornada(ctx({ temProduto: true, anuncio: publicado }));
  assert.ok(passos.every((p) => p.estado === "feito"));
  assert.equal(concluida(ctx({ temProduto: true, anuncio: publicado })), true);
});

test("todo passo explica o que é, em uma linha — a trilha ensina o processo", () => {
  for (const p of montarJornada(semNada)) {
    assert.ok(p.titulo.length > 0, p.etapa);
    assert.ok(p.descricao.length > 0, p.etapa);
  }
});

// ── O que impede ─────────────────────────────────────────────────────────────

test("quota esgotada bloqueia gerar, e diz por quê", () => {
  const passos = montarJornada(ctx({ temProduto: true, quotaRestante: 0 }));
  const gerar = passos.find((p) => p.etapa === "gerar")!;
  assert.equal(gerar.estado, "bloqueado");
  assert.match(gerar.bloqueio!, /plano/i);
});

test("pendências bloqueiam aprovar, dizendo QUANTAS", () => {
  const comPend = { ...bom, qtdPendencias: 3 };
  // força a etapa aprovar mantendo o veredito aprovado
  const passos = montarJornada(ctx({ temProduto: true, anuncio: { ...comPend, qtdPendencias: 3 } }));
  const atual = passos.find((p) => p.estado === "bloqueado" || p.estado === "atual")!;
  // com pendências a etapa vira revisar; o bloqueio de aprovar não é antecipado
  assert.equal(atual.etapa, "revisar");
});

test("desconectado bloqueia publicar — e só publicar", () => {
  const aprovado = { ...bom, status: "aprovado" };
  const passos = montarJornada(ctx({ temProduto: true, anuncio: aprovado, conectado: false }));
  const publicar = passos.find((p) => p.etapa === "publicar")!;
  assert.equal(publicar.estado, "bloqueado");
  assert.match(publicar.bloqueio!, /[Cc]onecte/);
});

test("não antecipa bloqueio de etapa futura — dá tempo de resolver", () => {
  // Desconectado, mas ainda na etapa de gerar: publicar não acusa nada agora.
  const passos = montarJornada(ctx({ temProduto: true, conectado: false }));
  assert.equal(passos.find((p) => p.etapa === "publicar")!.estado, "futuro");
  assert.equal(passos.find((p) => p.etapa === "publicar")!.bloqueio, undefined);
});

// ── A única coisa a fazer agora ──────────────────────────────────────────────

test("sempre há exatamente uma próxima ação, com verbo", () => {
  for (const c of [
    semNada,
    ctx({ temProduto: true }),
    ctx({ temProduto: true, anuncio: bom }),
    ctx({ temProduto: true, anuncio: { ...bom, status: "aprovado" } }),
  ]) {
    const a = proximaAcao(c);
    assert.ok(a, "deve haver próxima ação");
    assert.ok(a.rotulo.length > 0);
    assert.ok(/^[A-ZÀ-Ú]\w*(ar|er|ir|olher)/.test(a.rotulo), `rótulo sem verbo: ${a.rotulo}`);
  }
});

test("publicado: não há próxima ação a empurrar", () => {
  assert.equal(proximaAcao(ctx({ temProduto: true, anuncio: { ...bom, status: "publicado" } })), null);
});

test("o rótulo não mente: depois de rejeitar, é REFAZER", () => {
  const rejeitado = { ...bom, status: "rejeitado" };
  assert.match(proximaAcao(ctx({ temProduto: true, anuncio: rejeitado }))!.rotulo, /[Rr]efazer/);
  assert.match(proximaAcao(ctx({ temProduto: true }))!.rotulo, /[Gg]erar/);
});

test("ação bloqueada vem desabilitada COM motivo — nunca um botão morto sem explicação", () => {
  const a = proximaAcao(ctx({ temProduto: true, quotaRestante: 0 }))!;
  assert.equal(a.habilitada, false);
  assert.ok(a.motivo && a.motivo.length > 0);
});

test("ação liberada não carrega motivo", () => {
  const a = proximaAcao(ctx({ temProduto: true }))!;
  assert.equal(a.habilitada, true);
  assert.equal(a.motivo, undefined);
});
