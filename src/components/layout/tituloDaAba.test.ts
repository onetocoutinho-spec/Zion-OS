// O título da aba — a parte que dá para errar, provada.

import test from "node:test";
import assert from "node:assert/strict";
import { montarTituloDaAba, SUFIXO_DA_ABA } from "./tituloDaAba.ts";

test("a tela vem primeiro, o produto depois", () => {
  // A ordem é a decisão inteira: a aba encolhe pela DIREITA. Com seis abas
  // abertas o navegador mostra os primeiros caracteres, e "Zion OS — Pr…" não
  // distingue nada de nada.
  assert.equal(montarTituloDaAba("Produtos"), "Produtos — Zion OS");
});

test("sem nome de tela, sobra só o produto", () => {
  for (const vazio of ["", "   ", undefined]) {
    assert.equal(montarTituloDaAba(vazio), SUFIXO_DA_ABA, `falhou com ${JSON.stringify(vazio)}`);
  }
});

test("espaço em volta não vira espaço no título", () => {
  assert.equal(montarTituloDaAba("  Preços  "), "Preços — Zion OS");
});

test("o sufixo não é aplicado duas vezes", () => {
  // Acontece se alguém passar um título já montado, ou se as duas cascas
  // escreverem em sequência. "Produtos — Zion OS — Zion OS" é o tipo de coisa
  // que ninguém revisa depois que entra.
  assert.equal(montarTituloDaAba("Produtos — Zion OS"), "Produtos — Zion OS");
  assert.equal(montarTituloDaAba(SUFIXO_DA_ABA), SUFIXO_DA_ABA);
});

test("o sufixo é curto — a aba tem pouco espaço", () => {
  // Guarda uma tentação: pôr "Zion OS — Zion Company" aqui, que é o título
  // padrão do documento. Somado ao nome da tela não caberia em aba nenhuma, e
  // o começo (que é o que se lê) continuaria igual em todas.
  assert.ok(
    SUFIXO_DA_ABA.length <= 10,
    `o sufixo cresceu para "${SUFIXO_DA_ABA}" (${SUFIXO_DA_ABA.length} caracteres)`
  );
});
