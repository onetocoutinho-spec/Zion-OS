// "Saudável" era suposição nossa exibida como veredito.
//
// Auditado em 03/08/2026 (AUD-001): `classificarMargem` chama de "Saudável"
// qualquer margem acima do DOBRO do piso. O `* 2` apareceu no código e virou a
// palavra mais forte da tela de Precificação sem ninguém ter decidido que "o
// dobro do piso" é saudável.
//
// E quando a lojista não escolheu piso, entra 5% por padrão — o comentário de
// `MARGEM_MINIMA_PADRAO` já admite ("o piso que a Zion assumia pelo lojista"),
// e admitir no código sem admitir na tela é admitir para ninguém.
//
// A classificação NÃO muda aqui. O que muda é a tela poder dizer de onde vem.

import test from "node:test";
import assert from "node:assert/strict";
import {
  explicarClassificacao,
  classificarMargem,
  PISOS_PARA_SAUDAVEL,
} from "./modeloPreco.ts";

test("o dobro é declarado como convenção NOSSA, nas duas faixas que dependem dele", () => {
  for (const status of ["Saudável", "Atenção"] as const) {
    const f = explicarClassificacao(status, 5, true);
    assert.match(f, /convenção da Zion/);
    assert.match(f, /não regra do mercado/);
  }
});

test("piso NÃO escolhido é dito — não vira 'o seu piso'", () => {
  const f = explicarClassificacao("Saudável", 5, false);
  assert.match(f, /a Zion assumiu/);
  assert.match(f, /você ainda não escolheu o seu/);
  assert.ok(!f.includes("o seu piso de"), "chamou de dela um piso que ela nunca escolheu");
});

test("piso escolhido é tratado como dela", () => {
  const f = explicarClassificacao("Risco", 12, true);
  assert.match(f, /o seu piso de 12%/);
  assert.ok(!f.includes("assumiu"));
});

test("prejuízo não fala em convenção — negativo é fato, não limiar", () => {
  const f = explicarClassificacao("Prejuízo", 5, true);
  assert.match(f, /prejuízo/i);
  assert.ok(!f.includes("convenção"));
});

test("sem custo ou preço, a frase diz isso em vez de classificar", () => {
  assert.match(explicarClassificacao("—", 5, false), /Falta custo ou preço/);
});

test("a explicação acompanha a classificação real, faixa por faixa", () => {
  const piso = 10;
  // A fronteira é o dobro do piso: 19% ainda é Atenção, 20% já é Saudável.
  assert.equal(classificarMargem(piso * PISOS_PARA_SAUDAVEL - 1, piso), "Atenção");
  assert.equal(classificarMargem(piso * PISOS_PARA_SAUDAVEL, piso), "Saudável");
  assert.equal(classificarMargem(piso - 1, piso), "Risco");
  assert.equal(classificarMargem(-1, piso), "Prejuízo");
  assert.equal(classificarMargem(null, piso), "—");
});

test("a constante é nomeada e exportada — para ser encontrável quando a decisão vier", () => {
  assert.equal(PISOS_PARA_SAUDAVEL, 2);
});
