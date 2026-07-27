// Testes da parte PURA do serviço de custos — a montagem da embalagem.
//
// O resto do arquivo depende de rede e é coberto pelo comportamento do núcleo
// (modeloPreco). Aqui prova-se a regra que decide o frete de um produto com
// várias variantes.
// Rodar: npx tsx --test src/lib/services/taxasDoCliente.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { embalagemDasVariantes } from "./taxasDoCliente.ts";
import { pesoCobravelGramas } from "../../modules/pricing/domain/custosML.ts";

const v = (peso: number, altura: number, largura: number, comprimento: number) => ({
  peso,
  altura,
  largura,
  comprimento,
});

test("a variante guarda o peso em KG e o modelo cobra em GRAMAS", () => {
  const e = embalagemDasVariantes([v(0.4, 10, 20, 30)]);
  assert.ok(e);
  assert.equal(e.pesoGramas, 400);
});

test("variantes divergentes: vale a MAIOR embalagem", () => {
  // Subestimar o volume subestima o frete, e é esse o erro que faz o lojista
  // vender no prejuízo sem perceber.
  const e = embalagemDasVariantes([v(0.3, 8, 18, 28), v(0.5, 12, 22, 32)]);
  assert.ok(e);
  assert.equal(e.pesoGramas, 500);
  assert.equal(e.alturaCm, 12);
  assert.equal(e.larguraCm, 22);
  assert.equal(e.comprimentoCm, 32);
});

test("sem nenhuma medida devolve null — o envio vira pendência, não estimativa", () => {
  assert.equal(embalagemDasVariantes([]), null);
  assert.equal(embalagemDasVariantes([v(0, 0, 0, 0)]), null);
});

test("variante com só peso, sem dimensões, ainda serve", () => {
  const e = embalagemDasVariantes([v(0.35, 0, 0, 0)]);
  assert.ok(e);
  assert.equal(e.pesoGramas, 350);
  // sem dimensão não há cubagem, e o peso real prevalece
  assert.equal(pesoCobravelGramas(e), 350);
});

test("variante com só dimensões, sem peso, é cobrada pela cubagem", () => {
  const e = embalagemDasVariantes([v(0, 10, 20, 30)]);
  assert.ok(e);
  assert.equal(e.pesoGramas, 0);
  assert.equal(pesoCobravelGramas(e), 1000); // 6000 cm³ ÷ 6000 × 1000
});

test("a caixa montada das variantes chega no peso cobrável certo", () => {
  const e = embalagemDasVariantes([v(0.4, 10, 20, 30)]);
  assert.ok(e);
  assert.equal(pesoCobravelGramas(e), 1000); // cubado (1000 g) > real (400 g)
});
