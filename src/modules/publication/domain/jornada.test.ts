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
  avisoDeProdutoJaNoAr,
  type ContextoJornada,
  type AnuncioNaJornada,
} from "./jornada.ts";

const semNada: ContextoJornada = {
  temProduto: false,
  quantidadeFotos: 0,
  anuncio: null,
  conectado: true,
  quotaRestante: 10,
};

/** Produto já fotografado — o estado normal depois do passo de fotos. */
const comFotos = { temProduto: true, quantidadeFotos: 3 };

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
  assert.equal(etapaAtual(ctx({ ...comFotos })), "gerar");
});

test("anúncio gerado com pendências → revisar, não aprovar", () => {
  const comPendencia = { ...bom, qtdPendencias: 2, vereditoA10: "reprovado" };
  assert.equal(etapaAtual(ctx({ ...comFotos, anuncio: comPendencia })), "revisar");
});

test("anúncio limpo e aprovado pela revisão final → aprovar", () => {
  assert.equal(etapaAtual(ctx({ ...comFotos, anuncio: bom })), "aprovar");
});

test("anúncio já aprovado pelo lojista → publicar", () => {
  const aprovado = { ...bom, status: "aprovado" };
  assert.equal(etapaAtual(ctx({ ...comFotos, anuncio: aprovado })), "publicar");
});

test("anúncio rejeitado volta para gerar — o caminho é refazer", () => {
  const rejeitado = { ...bom, status: "rejeitado" };
  assert.equal(etapaAtual(ctx({ ...comFotos, anuncio: rejeitado })), "gerar");
});

test("a etapa vem do ESTADO, não de um contador — voltar à tela reencontra o lugar", () => {
  // Dois contextos idênticos produzem a mesma etapa, sem memória de navegação.
  const a = ctx({ ...comFotos, anuncio: bom });
  const b = ctx({ ...comFotos, anuncio: { ...bom } });
  assert.equal(etapaAtual(a), etapaAtual(b));
});

// ── A trilha ─────────────────────────────────────────────────────────────────

test("a trilha tem os cinco passos, sempre, na mesma ordem", () => {
  assert.deepEqual(
    montarJornada(semNada).map((p) => p.etapa),
    ["produto", "fotos", "gerar", "revisar", "aprovar", "publicar"]
  );
});

test("o que ficou para trás é 'feito', o que vem é 'futuro', e há exatamente um atual", () => {
  const passos = montarJornada(ctx({ ...comFotos, anuncio: bom }));
  assert.deepEqual(
    passos.map((p) => p.estado),
    ["feito", "feito", "feito", "feito", "atual", "futuro"]
  );
});

test("publicado: a trilha inteira fica feita", () => {
  const publicado = { ...bom, status: "publicado", mlItemId: "MLB1" };
  const passos = montarJornada(ctx({ ...comFotos, anuncio: publicado }));
  assert.ok(passos.every((p) => p.estado === "feito"));
  assert.equal(concluida(ctx({ ...comFotos, anuncio: publicado })), true);
});

test("todo passo explica o que é, em uma linha — a trilha ensina o processo", () => {
  for (const p of montarJornada(semNada)) {
    assert.ok(p.titulo.length > 0, p.etapa);
    assert.ok(p.descricao.length > 0, p.etapa);
  }
});

// ── O que impede ─────────────────────────────────────────────────────────────

test("quota esgotada bloqueia gerar, e diz por quê", () => {
  const passos = montarJornada(ctx({ ...comFotos, quotaRestante: 0 }));
  const gerar = passos.find((p) => p.etapa === "gerar")!;
  assert.equal(gerar.estado, "bloqueado");
  assert.match(gerar.bloqueio!, /plano/i);
});

test("pendências bloqueiam aprovar, dizendo QUANTAS", () => {
  const comPend = { ...bom, qtdPendencias: 3 };
  // força a etapa aprovar mantendo o veredito aprovado
  const passos = montarJornada(ctx({ ...comFotos, anuncio: { ...comPend, qtdPendencias: 3 } }));
  const atual = passos.find((p) => p.estado === "bloqueado" || p.estado === "atual")!;
  // com pendências a etapa vira revisar; o bloqueio de aprovar não é antecipado
  assert.equal(atual.etapa, "revisar");
});

test("desconectado bloqueia publicar — e só publicar", () => {
  const aprovado = { ...bom, status: "aprovado" };
  const passos = montarJornada(ctx({ ...comFotos, anuncio: aprovado, conectado: false }));
  const publicar = passos.find((p) => p.etapa === "publicar")!;
  assert.equal(publicar.estado, "bloqueado");
  assert.match(publicar.bloqueio!, /[Cc]onecte/);
});

test("não antecipa bloqueio de etapa futura — dá tempo de resolver", () => {
  // Desconectado, mas ainda na etapa de gerar: publicar não acusa nada agora.
  const passos = montarJornada(ctx({ ...comFotos, conectado: false }));
  assert.equal(passos.find((p) => p.etapa === "publicar")!.estado, "futuro");
  assert.equal(passos.find((p) => p.etapa === "publicar")!.bloqueio, undefined);
});

// ── A única coisa a fazer agora ──────────────────────────────────────────────

test("sempre há exatamente uma próxima ação, com verbo", () => {
  for (const c of [
    semNada,
    ctx({ ...comFotos }),
    ctx({ ...comFotos, anuncio: bom }),
    ctx({ ...comFotos, anuncio: { ...bom, status: "aprovado" } }),
  ]) {
    const a = proximaAcao(c);
    assert.ok(a, "deve haver próxima ação");
    assert.ok(a.rotulo.length > 0);
    assert.ok(/^[A-ZÀ-Ú]\w*(ar|er|ir|olher)/.test(a.rotulo), `rótulo sem verbo: ${a.rotulo}`);
  }
});

test("publicado: não há próxima ação a empurrar", () => {
  assert.equal(proximaAcao(ctx({ ...comFotos, anuncio: { ...bom, status: "publicado" } })), null);
});

test("o rótulo não mente: depois de rejeitar, é REFAZER", () => {
  const rejeitado = { ...bom, status: "rejeitado" };
  assert.match(proximaAcao(ctx({ ...comFotos, anuncio: rejeitado }))!.rotulo, /[Rr]efazer/);
  assert.match(proximaAcao(ctx({ ...comFotos }))!.rotulo, /[Gg]erar/);
});

test("ação bloqueada vem desabilitada COM motivo — nunca um botão morto sem explicação", () => {
  const a = proximaAcao(ctx({ ...comFotos, quotaRestante: 0 }))!;
  assert.equal(a.habilitada, false);
  assert.ok(a.motivo && a.motivo.length > 0);
});

test("ação liberada não carrega motivo", () => {
  const a = proximaAcao(ctx({ ...comFotos }))!;
  assert.equal(a.habilitada, true);
  assert.equal(a.motivo, undefined);
});

// ── Fotos: um passo, não uma parede ──────────────────────────────────────────

test("produto sem foto para na etapa de FOTOS, logo depois de escolher", () => {
  // Sem foto o ML recusa o anúncio. Cobrar isso agora, e não no último clique,
  // é a diferença entre um passo e uma parede.
  assert.equal(etapaAtual(ctx({ temProduto: true, quantidadeFotos: 0 })), "fotos");
});

test("a etapa de fotos vem ANTES de gerar — o trabalho não se perde", () => {
  const passos = montarJornada(ctx({ temProduto: true, quantidadeFotos: 0 }));
  assert.deepEqual(
    passos.map((p) => p.estado),
    ["feito", "atual", "futuro", "futuro", "futuro", "futuro"]
  );
});

test("com foto, a jornada segue para gerar", () => {
  assert.equal(etapaAtual(ctx({ temProduto: true, quantidadeFotos: 1 })), "gerar");
});

test("perder as fotos volta a jornada para lá, mesmo com anúncio pronto", () => {
  // Não adianta ter anúncio aprovado sem foto: a publicação seria recusada.
  const aprovado = { ...bom, status: "aprovado" };
  assert.equal(etapaAtual(ctx({ temProduto: true, quantidadeFotos: 0, anuncio: aprovado })), "fotos");
});

test("anúncio já publicado NÃO volta a pedir foto", () => {
  const publicado = { ...bom, status: "publicado" };
  assert.equal(
    etapaAtual(ctx({ temProduto: true, quantidadeFotos: 0, anuncio: publicado })),
    "publicar"
  );
  assert.equal(concluida(ctx({ temProduto: true, quantidadeFotos: 0, anuncio: publicado })), true);
});

test("a ação da etapa de fotos é um verbo e não vem bloqueada", () => {
  const a = proximaAcao(ctx({ temProduto: true, quantidadeFotos: 0 }))!;
  assert.equal(a.etapa, "fotos");
  assert.match(a.rotulo, /[Aa]dicionar/);
  assert.equal(a.habilitada, true);
});

test("a etapa de fotos explica POR QUE existe — não é capricho estético", () => {
  const fotos = montarJornada(semNada).find((p) => p.etapa === "fotos")!;
  assert.match(fotos.descricao, /Mercado Livre|exige/i);
});

// ===========================================================================
// A ESTEIRA CRIA — ela não melhora o que já está no ar
// ===========================================================================
//
// MEDIDO EM 14/08/2026: 88 rascunhos nesta conta, e **86 nasceram DEPOIS de o
// produto já estar no ar**. Nenhum é rascunho antigo que ficou para trás. A
// esteira olhava só o rascunho aberto e não sabia que o PRODUTO já tinha
// quarenta anúncios vendendo.

test("produto já no ar: a esteira AVISA que vai criar mais um", () => {
  const t = avisoDeProdutoJaNoAr({
    ...semNada,
    temProduto: true,
    quantidadeFotos: 3,
    anunciosNoArDoProduto: 40,
  });
  assert.match(t ?? "", /já tem 40 anúncios no ar/);
  assert.match(t ?? "", /um anúncio A MAIS/i);
  // E diz para onde ir: aviso sem saída ensina a lojista a ignorar aviso.
  assert.match(t ?? "", /assistente/);
});

test("um anúncio no ar fala no SINGULAR", () => {
  const t = avisoDeProdutoJaNoAr({ ...semNada, temProduto: true, anunciosNoArDoProduto: 1 });
  assert.match(t ?? "", /já tem 1 anúncio no ar/);
});

test("NÃO avisa o que não foi contado", () => {
  // Afirmar "nenhum no ar" sem ter contado é exatamente o defeito que este
  // repositório passou o mês arrancando. Sem número, sem frase.
  assert.equal(avisoDeProdutoJaNoAr({ ...semNada, temProduto: true }), null);
  assert.equal(
    avisoDeProdutoJaNoAr({ ...semNada, temProduto: true, anunciosNoArDoProduto: 0 }),
    null
  );
});

test("depois de publicar, o aviso SAI — ela acabou de fazer o que ele explicava", () => {
  const anuncio: AnuncioNaJornada = {
    status: "publicado",
    vereditoA10: "aprovado",
    qtdPendencias: 0,
    mlItemId: "MLB123",
    mlPermalink: null,
  };
  assert.equal(
    avisoDeProdutoJaNoAr({ ...semNada, temProduto: true, anuncio, anunciosNoArDoProduto: 40 }),
    null
  );
});

test("o aviso NÃO bloqueia — criar mais um é legítimo", () => {
  // Cor nova, kit, tamanho que faltava. O software informa; quem decide é ela.
  const ctx: ContextoJornada = {
    ...semNada,
    temProduto: true,
    quantidadeFotos: 3,
    anunciosNoArDoProduto: 40,
  };
  const acao = proximaAcao(ctx);
  assert.ok(acao, "a jornada parou de ter próxima ação");
  assert.equal(acao.habilitada, true, "o aviso virou bloqueio");
});
