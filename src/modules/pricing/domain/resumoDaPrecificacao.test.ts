// A abertura da Precificação: gravidade, zero, e o que não se sabe.

import test from "node:test";
import assert from "node:assert/strict";
import { resumoDaPrecificacao, type ContagemDeSaude } from "./resumoDaPrecificacao.ts";

const conta = (p: Partial<ContagemDeSaude> = {}): ContagemDeSaude => ({
  Saudável: 0,
  Atenção: 0,
  Risco: 0,
  Prejuízo: 0,
  ...p,
});

// ---------------------------------------------------------------------------
// A ORDEM É POR GRAVIDADE
// ---------------------------------------------------------------------------

test("prejuízo vence risco, risco vence atenção", () => {
  assert.match(
    resumoDaPrecificacao(conta({ Prejuízo: 3, Risco: 17, Atenção: 6 }), 0, 26).frase,
    /3 produtos vendem com prejuízo/
  );
  assert.match(
    resumoDaPrecificacao(conta({ Risco: 17, Atenção: 6 }), 0, 23).frase,
    /17 produtos vendem abaixo do seu piso/
  );
  assert.match(
    resumoDaPrecificacao(conta({ Atenção: 6, Saudável: 2 }), 0, 8).frase,
    /6 produtos estão perto do seu piso/
  );
});

test("ZERO nunca vira manchete", () => {
  // O defeito visível na conta real: "Prejuízo 0" com o mesmo peso de
  // "Risco 17". Dar manchete a um balde vazio transforma boa notícia em
  // alarme — e é assim que a pessoa aprende a ignorar a manchete.
  const r = resumoDaPrecificacao(conta({ Saudável: 2, Atenção: 6, Risco: 17, Prejuízo: 0 }), 50, 80);
  assert.match(r.frase, /17 produtos vendem abaixo/);
  assert.ok(!/prejuízo/i.test(r.frase), `o balde vazio virou manchete: "${r.frase}"`);
  assert.equal(r.tom, "atencao");
});

test("tudo saudável é dito com a ressalva de quantos são", () => {
  // "Está tudo bem" sem dizer sobre quantos é a mesma omissão de sempre.
  const r = resumoDaPrecificacao(conta({ Saudável: 25 }), 0, 25);
  assert.match(r.frase, /Os 25 que consigo calcular estão saudáveis/);
  assert.equal(r.tom, "ok");
});

// ---------------------------------------------------------------------------
// O QUE NÃO SE SABE APARECE — a lei da 050 aplicada a uma tela
// ---------------------------------------------------------------------------

test("os produtos sem custo são ditos, nunca omitidos", () => {
  // Os quatro números descrevem 25 de 80. Sem esta linha, eles parecem
  // descrever a loja inteira — e omitir o que não se sabe é a forma mais
  // silenciosa de mentir num painel.
  const r = resumoDaPrecificacao(conta({ Saudável: 2, Atenção: 6, Risco: 17 }), 50, 80);
  assert.equal(r.detalhe, "De 50 produtos não dá para dizer: falta o custo.");
  assert.equal(r.calculaveis, 25, "e a tela sabe sobre quantos os números falam");
});

test("sem lacuna de custo, não há ressalva inventada", () => {
  const r = resumoDaPrecificacao(conta({ Saudável: 80 }), 0, 80);
  assert.equal(r.detalhe, null);
});

test("nada calculável diz isso, e diz de quantos", () => {
  // O caso da conta que importou produtos e nenhum custo. A tela não pode
  // mostrar quatro zeros como se fosse diagnóstico.
  const r = resumoDaPrecificacao(conta(), 80, 80);
  assert.match(r.frase, /nenhum dos seus 80 produtos/);
  assert.equal(r.calculaveis, 0);
});

test("base vazia não fala de custo faltando", () => {
  const r = resumoDaPrecificacao(conta(), 0, 0);
  assert.match(r.frase, /Nenhum produto cadastrado/);
  assert.equal(r.detalhe, null);
});

// ---------------------------------------------------------------------------
// DETALHES QUE APARECEM NA TELA
// ---------------------------------------------------------------------------

test("o singular concorda", () => {
  assert.match(resumoDaPrecificacao(conta({ Risco: 1 }), 1, 2).frase, /^1 produto vende/);
  assert.equal(resumoDaPrecificacao(conta({ Risco: 1 }), 1, 2).detalhe, "De 1 produto não dá para dizer: falta o custo.");
});
