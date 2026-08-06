// As frases de Vendas e Auditoria: o que vira manchete, e o que não pode sumir.

import test from "node:test";
import assert from "node:assert/strict";
import {
  resumoDasVendas,
  resumoDaAuditoria,
  type MetricasDeVenda,
  type MetricasDeAuditoria,
} from "./resumoDoPulso.ts";

const venda = (p: Partial<MetricasDeVenda> = {}): MetricasDeVenda => ({
  faturamento: 10000,
  lucroLiquido: 2000,
  margem: 20,
  pedidos: 40,
  coberturaCusto: 100,
  ...p,
});

const auditoria = (p: Partial<MetricasDeAuditoria> = {}): MetricasDeAuditoria => ({
  total: 0,
  criticos: 0,
  altas: 0,
  seo: 0,
  imagem: 0,
  preco: 0,
  ...p,
});

// ---------------------------------------------------------------------------
// VENDAS
// ---------------------------------------------------------------------------

test("o LUCRO é a manchete, não o faturamento", () => {
  // Faturar muito e perder dinheiro é o que acontece com produtos vendendo
  // abaixo do piso. Um cartão de faturamento em verde, do mesmo tamanho do
  // lucro, conta a metade bonita da história.
  const r = resumoDasVendas(venda({ faturamento: 100000, lucroLiquido: 2000 }), 10, 30);
  assert.match(r.frase, /Lucro de/);
  assert.ok(!/100/.test(r.frase), `o faturamento virou manchete: "${r.frase}"`);
});

test("prejuízo é dito como prejuízo, com o valor positivo", () => {
  // "Lucro de -R$ 500" é um número que a pessoa lê duas vezes.
  const r = resumoDasVendas(venda({ lucroLiquido: -500, margem: -5 }), 10, 30);
  assert.match(r.frase, /Você perdeu/);
  assert.ok(!/-/.test(r.frase.replace(/—/g, "")), `sobrou sinal negativo: "${r.frase}"`);
  assert.equal(r.tom, "ruim");
});

test("margem abaixo do piso vence o lucro positivo", () => {
  // Lucro no azul e abaixo do mínimo que ELA definiu ainda é o fato da tela.
  const r = resumoDasVendas(venda({ lucroLiquido: 300, margem: 3 }), 10, 30);
  assert.match(r.frase, /abaixo do seu piso de 10%/);
  assert.equal(r.tom, "atencao");
});

test("acima do piso é boa notícia sem ressalva de piso", () => {
  const r = resumoDasVendas(venda({ margem: 22 }), 10, 30);
  assert.equal(r.tom, "ok");
  assert.ok(!/piso/.test(r.frase));
});

test("sem venda no período, a tela diz isso — não mostra oito zeros", () => {
  const r = resumoDasVendas(venda({ pedidos: 0, faturamento: 0, lucroLiquido: 0, margem: 0 }), 10, 30);
  assert.match(r.frase, /Nenhuma venda nos últimos 30 dias/);
  assert.equal(r.detalhe, null, "sem venda não há cobertura de custo a ressalvar");
});

test("cobertura parcial de custo é dita — o lucro está incompleto", () => {
  // Mesma lei da 050: o que não se sabe aparece. Sem isto, um lucro calculado
  // sobre metade dos itens parece o lucro inteiro.
  const r = resumoDasVendas(venda({ coberturaCusto: 37 }), 10, 30);
  assert.equal(r.detalhe, "Parcial: só 37% dos itens vendidos têm custo cadastrado.");
});

test("cobertura completa não inventa ressalva", () => {
  assert.equal(resumoDasVendas(venda({ coberturaCusto: 100 }), 10, 30).detalhe, null);
});

// ---------------------------------------------------------------------------
// AUDITORIA
// ---------------------------------------------------------------------------

test("críticos vencem prioridade alta", () => {
  const r = resumoDaAuditoria(auditoria({ total: 30, criticos: 4, altas: 9, imagem: 20 }));
  assert.match(r.frase, /4 produtos precisam de atenção urgente/);
  assert.equal(r.tom, "ruim");
});

test("a CATEGORIA dominante entra, e é ela que muda o que a lojista faz", () => {
  // "23 produtos com problema" manda abrir 23 telas. "quase tudo é foto" manda
  // chamar um fotógrafo. É a lição da faixa de Anúncios.
  const r = resumoDaAuditoria(auditoria({ total: 30, altas: 9, imagem: 22, preco: 3, seo: 5 }));
  assert.equal(r.detalhe, "A causa mais comum é foto: 22 de 30.");
});

test("empate resolve por foto, que é o trabalho mais caro de agendar", () => {
  const r = resumoDaAuditoria(auditoria({ total: 10, altas: 2, imagem: 5, preco: 5, seo: 5 }));
  assert.match(r.detalhe!, /^A causa mais comum é foto/);
});

test("sem categoria apontada, não se inventa uma", () => {
  const r = resumoDaAuditoria(auditoria({ total: 10, altas: 2 }));
  assert.equal(r.detalhe, null);
});

test("nada urgente é dito como boa notícia, com o total junto", () => {
  const r = resumoDaAuditoria(auditoria({ total: 30, imagem: 2 }));
  assert.match(r.frase, /Os 30 auditados estão sem urgência/);
  assert.equal(r.tom, "ok");
});

test("sem auditoria nenhuma, a frase não fala de zero produtos", () => {
  const r = resumoDaAuditoria(auditoria());
  assert.equal(r.frase, "Nenhuma auditoria ainda.");
  assert.equal(r.detalhe, null);
});

test("o singular concorda nos dois", () => {
  assert.match(resumoDaAuditoria(auditoria({ total: 1, criticos: 1 })).frase, /1 produto precisa/);
  assert.match(resumoDaAuditoria(auditoria({ total: 1, altas: 1 })).frase, /1 produto tem/);
});
