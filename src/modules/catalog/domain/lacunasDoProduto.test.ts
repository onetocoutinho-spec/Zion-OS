// Testes das lacunas por produto.
//
// A lista de produtos não dizia o que faltava em cada um — para descobrir, o
// lojista tinha que visitar outra tela. Era por isso que o Catálogo precisava
// de quatro portas.
// Rodar: npx tsx --test src/modules/catalog/domain/lacunasDoProduto.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  lacunasDoProduto,
  produtoCompleto,
  type EstadoDoProduto,
} from "./lacunasDoProduto.ts";

/** Um produto sem lacuna nenhuma; cada teste estraga só o que quer testar. */
function completo(over: Partial<EstadoDoProduto> = {}): EstadoDoProduto {
  return { custo: 69, precoVenda: 150, pesoGramas: 700, temFoto: true, ...over };
}

test("produto completo não inventa pendência", () => {
  assert.deepEqual(lacunasDoProduto(completo()), []);
  assert.equal(produtoCompleto(completo()), true);
});

test("custo vem antes de peso, e peso antes de foto", () => {
  // A ordem é por quanto destrava, não alfabética. Mandar a pessoa para o
  // trabalho que não produz resultado visível é como se perde a confiança.
  const vazio = lacunasDoProduto({ custo: 0, precoVenda: 0, pesoGramas: 0, temFoto: false });
  assert.deepEqual(
    vazio.map((l) => l.tipo),
    ["custo", "peso", "foto", "preco"]
  );
});

test("cada lacuna diz o que IMPEDE e para onde ir", () => {
  for (const l of lacunasDoProduto({ custo: 0, precoVenda: 0, pesoGramas: 0, temFoto: false })) {
    assert.ok(l.impede.length > 20, `${l.tipo} sem consequência escrita`);
    assert.match(l.href, /^\/cliente/, `${l.tipo} sem destino`);
    assert.ok(l.rotulo.length <= 8, `${l.tipo}: rótulo não cabe numa célula`);
  }
});

test("comprador pagando o frete DISPENSA o peso", () => {
  // Cobrar esse dado seria pedir algo que nunca vai ser usado — e a linha
  // ficaria eternamente marcada como incompleta.
  const semPeso = completo({ pesoGramas: 0, vendedorPagaFrete: false });
  assert.deepEqual(lacunasDoProduto(semPeso), []);
  assert.equal(produtoCompleto(semPeso), true);
});

test("não saber quem paga o frete MANTÉM o peso como lacuna", () => {
  // Mesma direção segura do modelo de preço: na dúvida, o vendedor paga.
  assert.equal(lacunasDoProduto(completo({ pesoGramas: 0 })).length, 1);
  assert.equal(
    lacunasDoProduto(completo({ pesoGramas: 0, vendedorPagaFrete: true }))[0].tipo,
    "peso"
  );
});

test("zero e negativo contam como ausente", () => {
  // Custo 0 é "não sei", não "de graça". Já gravamos R$ 1,77 de piso por tratar
  // um como o outro.
  assert.equal(lacunasDoProduto(completo({ custo: 0 }))[0].tipo, "custo");
  assert.equal(lacunasDoProduto(completo({ custo: -5 }))[0].tipo, "custo");
  assert.equal(lacunasDoProduto(completo({ precoVenda: 0 }))[0].tipo, "preco");
});

test("um produto pode ter várias lacunas ao mesmo tempo", () => {
  const meio = lacunasDoProduto(completo({ custo: 0, temFoto: false }));
  assert.deepEqual(meio.map((l) => l.tipo), ["custo", "foto"]);
});
