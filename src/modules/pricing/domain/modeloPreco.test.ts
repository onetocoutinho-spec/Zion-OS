// Testes do modelo de preço.
//
// ⚠️ OS TRÊS TESTES DE COMPATIBILIDADE FORAM APOSENTADOS DE PROPÓSITO.
// Eles comparavam contra as fórmulas antigas replicadas como oráculo, e
// existiam para provar que a PR #42 (margem editável) não mudava número nenhum.
// Agora os números MUDAM, porque os antigos estavam errados: comissão 30%
// (11 pontos fictícios sobre os 19% reais do Premium em Moda) e custo fixo de
// R$ 1,15 cobrado em todos os preços quando o ML cobra só abaixo do limiar.
// Ajustá-los para passar seria fingir que a correção não aconteceu.
//
// Rodar: npx tsx --test src/modules/pricing/domain/modeloPreco.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  custoDaVenda,
  custoDasTaxas,
  lucroLiquido,
  margemLiquida,
  precoMinimo,
  precoMinimoOuNull,
  margemValida,
  classificarMargem,
  comissaoPercentual,
  TAXAS_PADRAO,
  MARGEM_MINIMA_PADRAO,
  LIMIAR_FRETE_GRATIS,
  type ModeloTaxas,
} from "./modeloPreco.ts";

/** Caixa de chinelo: volumosa e leve — 1000 g cobráveis por cubagem. */
const CAIXA = { pesoGramas: 400, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 };

/** Modelo com frete conhecido, para os casos acima do limiar. */
const COM_FRETE: ModeloTaxas = {
  ...TAXAS_PADRAO,
  embalagem: CAIXA,
  tabelaFrete: [
    { atePesoGramas: 300, valor: 18.45 },
    { atePesoGramas: 5000, valor: 46 },
  ],
};

// ── A comissão real ──────────────────────────────────────────────────────────

test("Premium é o padrão do canal e vale 19% em Moda — não 30%", () => {
  assert.equal(comissaoPercentual(), 19);
  assert.equal(comissaoPercentual({ ...TAXAS_PADRAO, tipoAnuncio: "Clássico" }), 14);
});

test("os 11 pontos fictícios sumiram: R$ 100 paga R$ 19 de comissão", () => {
  assert.equal(custoDaVenda(100, COM_FRETE).comissao, 19);
});

// ── Custo fixo: só ABAIXO do limiar ──────────────────────────────────────────

test("abaixo do limiar incide custo fixo e NÃO incide frete", () => {
  const c = custoDaVenda(50);
  assert.ok(c.custoFixo > 0, "custo fixo deve incidir abaixo do limiar");
  assert.equal(c.frete, 0);
  assert.equal(c.pendencia, null); // fecha sempre, mesmo sem tabela de frete
});

test("a partir do limiar o custo fixo ZERA — o erro invertido do código antigo", () => {
  // Antes, R$ 1,15 era cobrado em todos os preços. O ML cobra só abaixo.
  assert.equal(custoDaVenda(LIMIAR_FRETE_GRATIS, COM_FRETE).custoFixo, 0);
  assert.equal(custoDaVenda(500, COM_FRETE).custoFixo, 0);
});

test("o custo fixo varia por faixa de PREÇO, não é número único", () => {
  const barato = custoDaVenda(15).custoFixo;
  const caro = custoDaVenda(70).custoFixo;
  assert.notEqual(barato, caro);
});

// ── Frete: onde falta dado, o resultado é null ───────────────────────────────

test("acima do limiar SEM tabela de frete: total é null, com pendência dita", () => {
  // Devolver zero faria o piso parecer menor do que é — o erro perigoso.
  const c = custoDaVenda(200);
  assert.equal(c.frete, null);
  assert.equal(c.total, null);
  assert.match(c.pendencia!, /peso|tabela/i);
});

test("acima do limiar COM tabela: o frete usa o peso CUBADO da caixa", () => {
  // 30×20×10 = 6000 cm³ → 1000 g cubados > 400 g reais → faixa de 5 kg.
  const c = custoDaVenda(200, COM_FRETE);
  assert.equal(c.frete, 46);
  assert.equal(c.total, arred(200 * 0.19 + 46));
  assert.equal(c.pendencia, null);
});

test("o subsídio de reputação desconta o frete de tabela", () => {
  const c = custoDaVenda(200, { ...COM_FRETE, subsidioFretePercentual: 50 });
  assert.equal(c.frete, 23);
});

test("margem e lucro viram null quando o frete é desconhecido — nunca um número", () => {
  assert.equal(custoDasTaxas(200), null);
  assert.equal(lucroLiquido(60, 200), null);
  assert.equal(margemLiquida(60, 200), null);
});

test("abaixo do limiar tudo continua calculável mesmo sem tabela de frete", () => {
  assert.ok(typeof custoDasTaxas(50) === "number");
  assert.ok(typeof margemLiquida(20, 50) === "number");
});

// ── Preço mínimo ─────────────────────────────────────────────────────────────

test("o piso ENTREGA de fato a margem pedida, abaixo do limiar", () => {
  for (const margem of [0, 5, 10, 20]) {
    for (const custo of [8, 15, 30]) {
      const r = precoMinimo(custo, margem);
      if (!r.ok) continue; // custo alto pode cruzar o limiar
      const obtida = margemLiquida(custo, r.preco);
      assert.ok(obtida !== null);
      assert.ok(
        Math.abs(obtida - margem) < 0.5,
        `custo ${custo}, pedida ${margem}%, obtida ${obtida}%`
      );
    }
  }
});

test("o piso ENTREGA a margem pedida acima do limiar, com frete conhecido", () => {
  const r = precoMinimo(60, 5, COM_FRETE);
  assert.ok(r.ok);
  const obtida = margemLiquida(60, r.preco, COM_FRETE);
  assert.ok(obtida !== null && Math.abs(obtida - 5) < 0.5, `obtida ${obtida}%`);
});

test("isolando a comissão: com o MESMO frete de antes, o piso CAI", () => {
  // O modelo antigo (comissão 30%, frete 14,15) dava piso R$ 115,85 para custo
  // 60. Trocando só a comissão para os 19% reais, o piso desce para ~97,57.
  const mesmoFrete: ModeloTaxas = {
    ...TAXAS_PADRAO,
    embalagem: CAIXA,
    tabelaFrete: [{ atePesoGramas: 5000, valor: 14.15 }],
  };
  const r = precoMinimo(60, MARGEM_MINIMA_PADRAO, mesmoFrete);
  assert.ok(r.ok);
  assert.ok(r.preco < 115.85, `piso ${r.preco} deveria ser menor que 115,85`);
});

test("mas com o frete REAL de tabela o piso SOBE — a direção depende do frete", () => {
  // Caixa de chinelo cuba 1000 g e cai na faixa de R$ 46, contra os R$ 14,15
  // chutados antes. A correção da comissão sozinha não torna ninguém mais
  // competitivo: quem decide a direção é o custo de envio, que é o dado que
  // ainda falta. Este teste existe para que essa conclusão não se perca.
  const r = precoMinimo(60, MARGEM_MINIMA_PADRAO, COM_FRETE);
  assert.ok(r.ok);
  assert.ok(r.preco > 115.85, `piso ${r.preco} deveria ser maior que 115,85`);
});

test("sem frete conhecido, o piso não é inventado: vem como limite INFERIOR", () => {
  const r = precoMinimo(60, 5);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.motivo === "frete_desconhecido");
  if (!r.ok && r.motivo === "frete_desconhecido") {
    assert.ok(r.pisoSemFrete >= LIMIAR_FRETE_GRATIS);
    // é limite inferior: o preço com frete tem de ser maior
    const comFrete = precoMinimo(60, 5, COM_FRETE);
    assert.ok(comFrete.ok && comFrete.preco > r.pisoSemFrete);
    assert.match(r.pendencia, /peso|tabela/i);
  }
});

test("margem impossível é dita como tal, não como número", () => {
  const r = precoMinimo(50, 90);
  assert.ok(!r.ok && r.motivo === "margem_impossivel");
  assert.equal(precoMinimoOuNull(50, 90), null);
});

test("com a comissão real, margens que antes eram impossíveis agora cabem", () => {
  // Com 30% de comissão, 75% de margem estourava. Com 19%, ainda cabe.
  const r = precoMinimo(30, 60);
  assert.ok(r.ok || r.motivo === "frete_desconhecido", "60% deve ser viável com 19%");
});

// ── Validação e saúde ────────────────────────────────────────────────────────

test("margem válida acompanha a comissão do tipo de anúncio", () => {
  assert.equal(margemValida(5), true);
  assert.equal(margemValida(-1), false);
  assert.equal(margemValida(61), false);
  assert.equal(margemValida(NaN), false);
  const caro: ModeloTaxas = { ...TAXAS_PADRAO, comissao: { classico: 90, premium: 95 } };
  assert.equal(margemValida(10, caro), false); // 95 + 10 ≥ 100
});

test("a saúde é medida contra a margem QUE O LOJISTA escolheu", () => {
  assert.equal(classificarMargem(8, 10), "Risco");
  assert.equal(classificarMargem(8, 4), "Saudável");
});

test("margem desconhecida não vira veredito", () => {
  // "Saudável" sobre um número que não existe seria mentira.
  assert.equal(classificarMargem(null, 5), "—");
});

test("prejuízo é prejuízo em qualquer configuração", () => {
  assert.equal(classificarMargem(-3, 0), "Prejuízo");
  assert.equal(classificarMargem(-0.1, 50), "Prejuízo");
});

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}
