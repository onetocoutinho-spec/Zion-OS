// Testes do modelo de preço (C).
//
// O teste mais importante é o primeiro bloco: com as taxas padrão, o resultado
// tem de ser IDÊNTICO ao que o código antigo produzia. Tornar a margem editável
// não pode alterar nenhum número que o cliente já vê hoje.
// Rodar: npx tsx --test src/modules/pricing/domain/modeloPreco.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  custoDasTaxas,
  lucroLiquido,
  margemLiquida,
  precoMinimo,
  margemValida,
  classificarMargem,
  TAXAS_PADRAO,
  MARGEM_MINIMA_PADRAO,
  type ModeloTaxas,
} from "./modeloPreco.ts";

// As fórmulas exatas do código anterior, replicadas aqui como oráculo.
const antigoTaxas = (p: number) =>
  p <= 0 ? 0 : Math.round((p * 0.3 + 1.15 + (p >= 79 ? 14.15 : 0)) * 100) / 100;
const antigoMargem = (custo: number, p: number) =>
  p <= 0 ? 0 : Math.round(((p - custo - p * 0.3 - 1.15 - (p >= 79 ? 14.15 : 0)) / p) * 1000) / 10;
const antigoPrecoMinimo = (custo: number) => {
  const semFrete = (custo + 1.15) / 0.65;
  return Math.round((semFrete >= 79 ? (custo + 1.15 + 14.15) / 0.65 : semFrete) * 100) / 100;
};

// ── Compatibilidade: nada muda para quem já usa ──────────────────────────────

test("com as taxas padrão, as taxas batem com o cálculo antigo", () => {
  for (const p of [0, 10, 45.9, 78.99, 79, 79.01, 129.9, 350, 1200]) {
    assert.equal(custoDasTaxas(p), antigoTaxas(p), `preço ${p}`);
  }
});

test("com as taxas padrão, a margem bate com o cálculo antigo", () => {
  for (const [custo, p] of [[20, 60], [30, 129.9], [10, 78.99], [10, 79], [200, 350]]) {
    assert.equal(margemLiquida(custo, p), antigoMargem(custo, p), `custo ${custo} preço ${p}`);
  }
});

test("com margem 5% e taxas padrão, o preço mínimo bate com o piso Zion antigo", () => {
  // O 0,65 do código antigo era exatamente 1 − 30% de comissão − 5% de margem.
  for (const custo of [5, 12.4, 30, 47.8, 100, 250]) {
    assert.equal(
      precoMinimo(custo, MARGEM_MINIMA_PADRAO),
      antigoPrecoMinimo(custo),
      `custo ${custo}`
    );
  }
});

// ── A margem passa a ser escolha ─────────────────────────────────────────────

test("margem maior exige preço maior — a escolha do lojista move o piso", () => {
  const custo = 40;
  const p5 = precoMinimo(custo, 5)!;
  const p15 = precoMinimo(custo, 15)!;
  const p30 = precoMinimo(custo, 30)!;
  assert.ok(p5 < p15 && p15 < p30, `${p5} < ${p15} < ${p30}`);
});

test("o preço mínimo ENTREGA de fato a margem pedida", () => {
  // A prova real: precificar no piso e medir a margem devolve o que foi pedido.
  for (const margem of [0, 5, 10, 20, 35]) {
    for (const custo of [8, 30, 120]) {
      const piso = precoMinimo(custo, margem);
      assert.ok(piso !== null);
      const obtida = margemLiquida(custo, piso);
      assert.ok(
        Math.abs(obtida - margem) < 0.35,
        `custo ${custo}, margem pedida ${margem}%, obtida ${obtida}%`
      );
    }
  }
});

test("margem impossível devolve null — não devolve um número mentiroso", () => {
  // 30% de comissão + 70% de margem não sobra nada: não existe preço.
  assert.equal(precoMinimo(50, 70), null);
  assert.equal(precoMinimo(50, 100), null);
});

test("margem válida: rejeita o que não fecha conta e o que sai da faixa", () => {
  assert.equal(margemValida(5), true);
  assert.equal(margemValida(0), true);
  assert.equal(margemValida(-1), false);
  assert.equal(margemValida(61), false); // acima do teto permitido
  assert.equal(margemValida(NaN), false);
  // com comissão alta, a margem que sobra é menor — a validação acompanha
  const caro: ModeloTaxas = { ...TAXAS_PADRAO, comissaoPercentual: 55 };
  assert.equal(margemValida(50, caro), false); // 55 + 50 ≥ 100
  assert.equal(margemValida(40, caro), true);
});

// ── As taxas viram parâmetro (ainda não editáveis pelo cliente) ──────────────

test("comissão menor sobra mais lucro — o modelo responde ao parâmetro", () => {
  const real: ModeloTaxas = { ...TAXAS_PADRAO, comissaoPercentual: 14 };
  assert.ok(lucroLiquido(40, 129.9, real) > lucroLiquido(40, 129.9));
});

test("o frete só incide a partir do limiar", () => {
  const t = TAXAS_PADRAO;
  assert.equal(custoDasTaxas(t.limiarFrete - 0.01), antigoTaxas(78.99));
  const abaixo = custoDasTaxas(78.99);
  const acima = custoDasTaxas(79);
  assert.ok(acima - abaixo > 14, `salto de frete esperado no limiar: ${abaixo} → ${acima}`);
});

// ── Saúde medida contra a escolha do lojista ─────────────────────────────────

test("a saúde é medida contra a margem QUE O LOJISTA escolheu", () => {
  // 8% é Risco para quem exige 10%, e Saudável para quem exige 4%.
  assert.equal(classificarMargem(8, 10), "Risco");
  assert.equal(classificarMargem(8, 4), "Saudável");
});

test("prejuízo é prejuízo em qualquer configuração", () => {
  assert.equal(classificarMargem(-3, 0), "Prejuízo");
  assert.equal(classificarMargem(-0.1, 50), "Prejuízo");
});

test("sem dados suficientes a saúde não inventa veredito", () => {
  assert.equal(classificarMargem(null, 5), "—");
});

test("com margem mínima 5%, as faixas reproduzem as de hoje (Risco <10, Atenção <20)", () => {
  assert.equal(classificarMargem(9.9, 5), "Atenção"); // ≥ 5 e < 10
  assert.equal(classificarMargem(4.9, 5), "Risco"); // < 5
  assert.equal(classificarMargem(19, 5), "Saudável"); // ≥ 10
});
