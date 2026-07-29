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
  envioDoModelo,
  type ModeloTaxas,
  custoDaVenda,
  custoDasTaxas,
  lucroLiquido,
  margemLiquida,
  precoMinimo,
  precoMinimoOuNull,
  margemValida,
  classificarMargem,
  comissaoPercentual,
  taxaFixaVenda,
  TAXAS_PADRAO,
  MARGEM_MINIMA_PADRAO,
  LIMIAR_FRETE_GRATIS,
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

// ── A API do ML tem precedência sobre a nossa tabela ─────────────────────────

test("o percentual vindo da API prevalece sobre a tabela de Moda", () => {
  // A tabela só conhece Moda; a API conhece a categoria exata do produto.
  const outraCategoria: ModeloTaxas = { ...REAL, percentualVendaML: 11 };
  assert.equal(comissaoPercentual(outraCategoria), 11);
  assert.equal(custoDaVenda(100, outraCategoria).comissao, 11);
});

test("percentual corrompido é ignorado — a tabela é mais confiável que lixo", () => {
  for (const ruim of [-5, 100, 250, NaN, Infinity]) {
    assert.equal(comissaoPercentual({ ...REAL, percentualVendaML: ruim }), 19, `valor ${ruim}`);
  }
});

test("percentual ZERO é legítimo (anúncio grátis) e não cai no fallback", () => {
  assert.equal(comissaoPercentual({ ...REAL, percentualVendaML: 0 }), 0);
});

test("ausência de resposta da API mantém a tabela", () => {
  assert.equal(comissaoPercentual({ ...REAL, percentualVendaML: null }), 19);
  assert.equal(comissaoPercentual({ ...REAL, percentualVendaML: undefined }), 19);
});

test("taxa fixa da API entra na conta e sobe o piso", () => {
  // Em ME2 sem Flex o ML documenta zero, mas se vier, respeitamos.
  const comFixa: ModeloTaxas = { ...REAL, taxaFixaVendaML: 6.5 };
  assert.equal(custoDaVenda(100, comFixa).taxaFixa, 6.5);
  assert.equal(custoDaVenda(100, comFixa).total, custoDaVenda(100, REAL).total! + 6.5);
  const semFixa = precoMinimo(60, 5, REAL);
  const piso = precoMinimo(60, 5, comFixa);
  assert.ok(semFixa.ok && piso.ok && piso.preco > semFixa.preco);
});

test("taxa fixa ausente ou inválida vale zero", () => {
  assert.equal(taxaFixaVenda(REAL), 0);
  assert.equal(taxaFixaVenda({ ...REAL, taxaFixaVendaML: -3 }), 0);
  assert.equal(taxaFixaVenda({ ...REAL, taxaFixaVendaML: NaN }), 0);
});

test("sem custo NÃO se afirma lucro", () => {
  // A tela mostrava "custo R$ 0 · preço R$ 128 · taxas R$ 43 · lucro R$ 85"
  // para 28 produtos: o lucro de uma sandália que não custou nada. Na mesma
  // linha a margem já dizia "—" — o chamador guardava margem e piso com
  // custo > 0 e esquecia o lucro.
  const comPeso: ModeloTaxas = { ...TAXAS_PADRAO, embalagem: { pesoGramas: 700, alturaCm: 13, larguraCm: 13, comprimentoCm: 13 } };
  assert.equal(lucroLiquido(0, 128, comPeso), null);
  assert.equal(lucroLiquido(-5, 128, comPeso), null);
  assert.equal(lucroLiquido(Number.NaN, 128, comPeso), null);
  // com custo, volta a responder
  assert.ok((lucroLiquido(69, 150, comPeso) ?? 0) > 0);
});

test("margem também não sai sem custo — as duas colunas contam a mesma história", () => {
  const comPeso: ModeloTaxas = { ...TAXAS_PADRAO, embalagem: { pesoGramas: 700, alturaCm: 13, larguraCm: 13, comprimentoCm: 13 } };
  assert.equal(margemLiquida(0, 128, comPeso), null);
});

// ---- Custos do lojista: o que faltava na conta ----

/** Os parâmetros reais da planilha da Chinelaria Leilane. */
const CUSTOS_LEILANE = {
  embalagem: 0.5,
  etiqueta: 0.15,
  informativos: 0.5,
  impostoPercentual: 12,
  comissaoGestorPercentual: 1,
  comissaoSistemaPercentual: 1,
  cupomPercentual: 0,
};

const COM_PESO: ModeloTaxas = {
  ...TAXAS_PADRAO,
  embalagem: { pesoGramas: 700, alturaCm: 13, larguraCm: 13, comprimentoCm: 13 },
};

test("sem custos do lojista, a conta é IDÊNTICA à de antes", () => {
  // O default zero é o que permite ligar isto sem mexer em quem já usava.
  const semCampo = custoDasTaxas(150, COM_PESO);
  const comZeros = custoDasTaxas(150, { ...COM_PESO, custosDoLojista: null });
  assert.equal(semCampo, comZeros);
});

test("o caso real: a margem cai de otimista para verdadeira", () => {
  // Sandália Vizzano, custo R$ 69, preço R$ 150. O Zion dizia 20,7% de margem
  // e "Saudável"; a planilha do lojista mostrava ~6%, porque contava imposto,
  // comissões internas e os fixos por pedido.
  const comCustos: ModeloTaxas = { ...COM_PESO, custosDoLojista: CUSTOS_LEILANE };

  // O lucro está em REAIS e é exato — a margem arredonda a uma casa, e
  // reconstruir reais a partir dela perderia centavos.
  const lucroAntes = lucroLiquido(69, 150, COM_PESO);
  const lucroDepois = lucroLiquido(69, 150, comCustos);
  assert.ok(lucroAntes !== null && lucroDepois !== null);
  // 14% de 150 = R$ 21, mais R$ 1,15 de fixos = R$ 22,15 a menos de lucro.
  assert.equal(Math.round((lucroAntes - lucroDepois) * 100) / 100, 22.15);

  const antes = margemLiquida(69, 150, COM_PESO);
  const depois = margemLiquida(69, 150, comCustos);
  assert.ok(antes !== null && depois !== null);
  assert.ok(depois < antes - 14, "a diferença tem que ser material, não decimal");
});

test("o preço mínimo sobe quando os custos entram no divisor", () => {
  const semCustos = precoMinimo(69, 10, COM_PESO);
  const comCustos = precoMinimo(69, 10, { ...COM_PESO, custosDoLojista: CUSTOS_LEILANE });
  assert.ok(semCustos.ok && comCustos.ok);
  assert.ok(
    comCustos.preco > semCustos.preco,
    "cobrir imposto e comissões internas exige preço maior"
  );
});

test("percentuais que somam 100 ou mais tornam a margem impossível", () => {
  // Sem esta guarda o divisor viraria zero ou negativo, e o preço mínimo
  // explodiria para infinito ou ficaria negativo — número absurdo com cara de
  // resposta, que é o defeito que este sistema mais repetiu.
  const absurdo: ModeloTaxas = {
    ...COM_PESO,
    custosDoLojista: { ...CUSTOS_LEILANE, impostoPercentual: 90 },
  };
  const r = precoMinimo(69, 10, absurdo);
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.motivo === "margem_impossivel");
});

// ---- Quem paga o frete ----

test("comprador paga o frete: o envio some da conta do lojista", () => {
  // Descontar um frete que o lojista não paga mostraria margem menor que a real.
  const compradorPaga: ModeloTaxas = { ...COM_PESO, vendedorPagaFrete: false };
  assert.equal(envioDoModelo(150, compradorPaga), 0);
  assert.ok((envioDoModelo(150, COM_PESO) ?? 0) > 0, "com o vendedor pagando, há frete");
});

test("sem peso E comprador pagando NÃO é pendência", () => {
  // Sem custo de envio, não faltar peso não impede nada. A ordem da guarda
  // importa: peso primeiro transformaria isto num "falta frete" eterno.
  const semPeso: ModeloTaxas = { ...TAXAS_PADRAO, vendedorPagaFrete: false };
  assert.equal(envioDoModelo(150, semPeso), 0);
  const r = precoMinimo(69, 10, semPeso);
  assert.equal(r.ok, true);
});

test("não saber quem paga ASSUME que o vendedor paga", () => {
  // Supor que não paga inflaria a margem, e margem otimista é o defeito que
  // este modelo mais repetiu.
  assert.equal(envioDoModelo(150, COM_PESO), envioDoModelo(150, { ...COM_PESO, vendedorPagaFrete: undefined }));
});
