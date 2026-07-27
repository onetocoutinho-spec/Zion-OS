// Testes do modelo de preço.
//
// Os números aqui saem da tabela OFICIAL do ML (tabelaEnvioML.ts). Duas gerações
// de testes já foram aposentadas neste arquivo, e vale registrar por quê:
//
//   1ª — provavam compatibilidade com a fórmula de 30% de comissão + R$ 1,15
//        fixo + R$ 14,15 de frete. Tudo chute; caíram com a correção.
//   2ª — provavam que o frete era "desconhecido" e virava pendência. Existia
//        tabela pública o tempo todo; caíram quando ela foi encodada.
//
// O que sobrevive é o princípio: onde falta dado (o PESO), o resultado é null.
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

/** Caixa de chinelo: 30×20×10 cm e 400 g → 1000 g cobráveis por cubagem. */
const CAIXA = { pesoGramas: 400, alturaCm: 10, larguraCm: 20, comprimentoCm: 30 };

/** O modelo real de um lojista de calçado: Premium, verde, com a caixa medida. */
const REAL: ModeloTaxas = { ...TAXAS_PADRAO, embalagem: CAIXA };

// ── A comissão real ──────────────────────────────────────────────────────────

test("Premium é o padrão do canal e vale 19% em Moda — não 30%", () => {
  assert.equal(comissaoPercentual(), 19);
  assert.equal(comissaoPercentual({ ...TAXAS_PADRAO, tipoAnuncio: "Clássico" }), 14);
});

test("os 11 pontos fictícios sumiram: R$ 100 paga R$ 19 de comissão", () => {
  assert.equal(custoDaVenda(100, REAL).comissao, 19);
});

// ── O envio incide sempre ────────────────────────────────────────────────────

test("abaixo do limiar o envio NÃO é zero — o modelo anterior errava por baixo", () => {
  const c = custoDaVenda(50, REAL);
  assert.ok(c.envio !== null && c.envio > 0);
  assert.equal(c.pendencia, null);
  // comissão 9,50 + envio 7,95 (1 kg cubado, faixa R$ 49–78,99)
  assert.equal(c.total, 17.45);
});

test("no limiar o custo salta, porque o frete grátis vira do vendedor", () => {
  const abaixo = custoDaVenda(LIMIAR_FRETE_GRATIS - 0.01, REAL).envio!;
  const acima = custoDaVenda(LIMIAR_FRETE_GRATIS, REAL).envio!;
  assert.ok(acima > abaixo * 1.5, `${abaixo} → ${acima}`);
});

test("o preço entra DUAS vezes na conta: pela comissão e pela faixa de envio", () => {
  const barato = custoDaVenda(90, REAL);
  const caro = custoDaVenda(250, REAL);
  assert.ok(caro.comissao > barato.comissao);
  assert.ok(caro.envio! > barato.envio!, "a faixa de envio também sobe com o preço");
});

// ── Sem peso, o resultado é null ─────────────────────────────────────────────

test("sem a embalagem medida, nada é afirmado", () => {
  // TAXAS_PADRAO não tem embalagem: é o estado de quem ainda não mediu.
  assert.equal(custoDasTaxas(200), null);
  assert.equal(lucroLiquido(60, 200), null);
  assert.equal(margemLiquida(60, 200), null);
  const c = custoDaVenda(200);
  assert.equal(c.envio, null);
  assert.match(c.pendencia!, /peso|medidas/i);
});

test("com a embalagem medida, tudo fecha", () => {
  assert.ok(typeof custoDasTaxas(200, REAL) === "number");
  assert.ok(typeof margemLiquida(60, 200, REAL) === "number");
});

// ── Preço mínimo ─────────────────────────────────────────────────────────────

test("o piso ENTREGA de fato a margem pedida, em várias faixas de preço", () => {
  for (const margem of [0, 5, 10, 20]) {
    for (const custo of [8, 30, 60, 150]) {
      const r = precoMinimo(custo, margem, REAL);
      assert.ok(r.ok, `custo ${custo} margem ${margem} deveria resolver`);
      const obtida = margemLiquida(custo, r.preco, REAL);
      assert.ok(obtida !== null);
      assert.ok(
        obtida >= margem - 0.6,
        `custo ${custo}, pedida ${margem}%, obtida ${obtida}% (preço ${r.preco})`
      );
    }
  }
});

test("o piso nunca entrega MENOS do que o lojista pediu", () => {
  // Errar para cima é conservador; errar para baixo faz vender no prejuízo.
  for (const custo of [12, 45, 90]) {
    const r = precoMinimo(custo, 15, REAL);
    assert.ok(r.ok);
    assert.ok(margemLiquida(custo, r.preco, REAL)! >= 14.4);
  }
});

test("sem peso, o piso não é inventado", () => {
  const r = precoMinimo(60, 5);
  assert.ok(!r.ok && r.motivo === "sem_peso");
  assert.equal(precoMinimoOuNull(60, 5), null);
});

test("margem impossível é dita como tal, não como número", () => {
  const r = precoMinimo(50, 90, REAL);
  assert.ok(!r.ok && r.motivo === "margem_impossivel");
  assert.equal(precoMinimoOuNull(50, 90, REAL), null);
});

test("com a comissão real, margens que antes eram impossíveis agora cabem", () => {
  // Com 30% de comissão, 75% de margem estourava. Com 19%, ainda cabe.
  assert.ok(precoMinimo(30, 60, REAL).ok);
});

test("reputação pior encarece o envio e sobe o piso", () => {
  const verde = precoMinimo(60, 5, REAL);
  const laranja = precoMinimo(60, 5, { ...REAL, reputacao: "laranja" });
  assert.ok(verde.ok && laranja.ok);
  assert.ok(laranja.preco > verde.preco, `${verde.preco} → ${laranja.preco}`);
});

test("anúncio Clássico permite piso menor que Premium — comissão menor", () => {
  const premium = precoMinimo(60, 5, REAL);
  const classico = precoMinimo(60, 5, { ...REAL, tipoAnuncio: "Clássico" });
  assert.ok(premium.ok && classico.ok);
  assert.ok(classico.preco < premium.preco);
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
  assert.equal(classificarMargem(null, MARGEM_MINIMA_PADRAO), "—");
});

test("prejuízo é prejuízo em qualquer configuração", () => {
  assert.equal(classificarMargem(-3, 0), "Prejuízo");
  assert.equal(classificarMargem(-0.1, 50), "Prejuízo");
});
