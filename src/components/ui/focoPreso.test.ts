// A regra do foco preso, provada nas bordas — que é onde ela existe.

import test from "node:test";
import assert from "node:assert/strict";
import { proximoIndiceDoFoco, SELETOR_FOCAVEL } from "./focoPreso.ts";

const ADIANTE = false;
const PARA_TRAS = true;

// ---------------------------------------------------------------------------
// AS DUAS BORDAS — o motivo de a função existir
// ---------------------------------------------------------------------------

test("Tab no último volta para o primeiro", () => {
  assert.equal(proximoIndiceDoFoco(4, 3, ADIANTE), 0);
});

test("Shift+Tab no primeiro vai para o último", () => {
  assert.equal(proximoIndiceDoFoco(4, 0, PARA_TRAS), 3);
});

// ---------------------------------------------------------------------------
// O MEIO — onde NÃO intervir é a decisão
// ---------------------------------------------------------------------------

test("no meio, quem manda é o navegador", () => {
  // `null` não é "não sei": é "siga". Calcular `(atual + 1) % total` aqui
  // reimplementaria o Tab e quebraria grupo de rádio (uma parada, anda com as
  // setas) e ordem visual diferente da ordem do DOM.
  for (const i of [1, 2]) {
    assert.equal(proximoIndiceDoFoco(4, i, ADIANTE), null, `adiante em ${i}`);
    assert.equal(proximoIndiceDoFoco(4, i, PARA_TRAS), null, `para trás em ${i}`);
  }
});

test("o penúltimo ainda é meio, e o segundo também", () => {
  // Guarda um erro de mais-ou-menos-um: se a borda virasse `total - 2`, o foco
  // pularia o último elemento — em geral o botão de confirmar.
  assert.equal(proximoIndiceDoFoco(4, 2, ADIANTE), null);
  assert.equal(proximoIndiceDoFoco(4, 1, PARA_TRAS), null);
});

// ---------------------------------------------------------------------------
// O FOCO ESCAPOU
// ---------------------------------------------------------------------------

test("com o foco fora, o Tab entra pelo começo e o Shift+Tab pelo fim", () => {
  // Acontece de verdade: clique no fundo escuro tira o foco para o `body`, e
  // um elemento que some (o botão que estava focado) leva o foco junto. Sem
  // isto, o Tab seguinte sairia do diálogo — que é exatamente o defeito.
  assert.equal(proximoIndiceDoFoco(4, -1, ADIANTE), 0);
  assert.equal(proximoIndiceDoFoco(4, -1, PARA_TRAS), 3);
});

// ---------------------------------------------------------------------------
// OS EXTREMOS
// ---------------------------------------------------------------------------

test("com um único focável, o Tab fica nele", () => {
  // As duas bordas são o mesmo elemento. O foco não tem para onde ir e não
  // pode sair — devolver 0 nos dois sentidos é o que prende.
  assert.equal(proximoIndiceDoFoco(1, 0, ADIANTE), 0);
  assert.equal(proximoIndiceDoFoco(1, 0, PARA_TRAS), 0);
});

test("sem nenhum focável, devolve null em vez de inventar índice", () => {
  // Um diálogo só de texto. Devolver 0 aqui mandaria focar `lista[0]`, que não
  // existe. Quem trata é o hook, pondo o foco na caixa.
  assert.equal(proximoIndiceDoFoco(0, -1, ADIANTE), null);
  assert.equal(proximoIndiceDoFoco(0, -1, PARA_TRAS), null);
});

test("total negativo não vira índice", () => {
  // Não deveria acontecer, e por isso mesmo: se acontecer, o erro aparece como
  // `null` (nada foca) e não como `focar(lista[-2])`.
  assert.equal(proximoIndiceDoFoco(-1, 0, ADIANTE), null);
});

// ---------------------------------------------------------------------------
// O SELETOR
// ---------------------------------------------------------------------------

test("a caixa do diálogo não é uma parada do Tab", () => {
  // `[tabindex="-1"]` fora do seletor é o que deixa a caixa receber o foco
  // inicial por programa SEM virar uma parada a mais na volta do Tab. Se
  // entrasse, o ciclo teria um passo fantasma no começo.
  assert.match(SELETOR_FOCAVEL, /\[tabindex\]:not\(\[tabindex="-1"\]\)/);
  assert.ok(
    !/\[tabindex\](?!:not)/.test(SELETOR_FOCAVEL),
    "o seletor passou a aceitar qualquer [tabindex], inclusive -1"
  );
});

test("controle desabilitado não recebe foco", () => {
  // Um botão "Publicar" desabilitado enquanto a publicação corre continua no
  // DOM. Sem o `:not([disabled])` ele entraria no ciclo e o Tab pararia num
  // botão que não faz nada.
  for (const tag of ["button", "input", "select", "textarea"]) {
    assert.match(
      SELETOR_FOCAVEL,
      new RegExp(`${tag}:not\\(\\[disabled\\]\\)`),
      `${tag} entra no ciclo mesmo desabilitado`
    );
  }
});
