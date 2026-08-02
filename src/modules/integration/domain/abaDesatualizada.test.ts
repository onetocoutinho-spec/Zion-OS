// Uma aba velha não é erro. Ficar calada sobre isso, é.
//
// ===========================================================================
// AS TRÊS VEZES QUE ISTO CUSTOU CARO
// ===========================================================================
//
// 01–02/08/2026, sempre a mesma aba aberta atravessando um deploy:
//
//  1. a importação de 279 anúncios gravou ZERO estado de marketplace, porque a
//     aba não tinha o código que grava. O zero foi investigado como se fosse
//     defeito do código novo;
//  2. a atualização de estado dos 502 anúncios não rodou, pelo mesmo motivo;
//  3. a linha de "campos exigidos que faltam" não apareceu, e não dava para
//     dizer se era ausência de defeito ou ausência de código.
//
// Nas três, a tela entregou resultado PARCIAL que se lê como completo — o mesmo
// defeito do teto de 500 e do `status: "publicado"` fixo, em outro lugar.

import test from "node:test";
import assert from "node:assert/strict";
import { abaDesatualizada, AVISO_ABA_DESATUALIZADA } from "./abaDesatualizada.ts";

test("versões diferentes: a aba está velha", () => {
  assert.equal(abaDesatualizada({ doNavegador: "abc123", doServidor: "def456" }), true);
});

test("versões iguais: nada a avisar", () => {
  assert.equal(abaDesatualizada({ doNavegador: "abc123", doServidor: "abc123" }), false);
});

test("`dev` dos dois lados nunca avisa — é o ambiente local", () => {
  assert.equal(abaDesatualizada({ doNavegador: "dev", doServidor: "dev" }), false);
});

// ---------------------------------------------------------------------------
// "NÃO SEI" NUNCA VIRA AVISO
// ---------------------------------------------------------------------------

test("servidor que não se identifica não acusa a aba", () => {
  // Um servidor antigo, sem o campo, faria TODA aba parecer velha. Alarme que
  // dispara sem fato o usuário aprende a ignorar — e aí não serve para o dia
  // em que houver fato.
  assert.equal(abaDesatualizada({ doNavegador: "abc123", doServidor: undefined }), false);
  assert.equal(abaDesatualizada({ doNavegador: "abc123", doServidor: "" }), false);
  assert.equal(abaDesatualizada({ doNavegador: "abc123", doServidor: "   " }), false);
});

test("pacote que não se identifica também não acusa", () => {
  assert.equal(abaDesatualizada({ doNavegador: undefined, doServidor: "abc123" }), false);
  assert.equal(abaDesatualizada({ doNavegador: "", doServidor: "abc123" }), false);
});

test("nenhum dos dois lados identificado: silêncio", () => {
  assert.equal(abaDesatualizada({ doNavegador: undefined, doServidor: undefined }), false);
});

test("espaço em volta não inventa divergência", () => {
  assert.equal(abaDesatualizada({ doNavegador: " abc ", doServidor: "abc" }), false);
});

// ---------------------------------------------------------------------------
// A FRASE
// ---------------------------------------------------------------------------

test("o aviso diz a AÇÃO e diz que o resultado pode estar incompleto", () => {
  // Sem a ação, o usuário sabe que há um problema e não o que fazer. Sem a
  // ressalva, ele acredita no número que acabou de ler.
  assert.match(AVISO_ABA_DESATUALIZADA, /recarregue/i);
  assert.match(AVISO_ABA_DESATUALIZADA, /Ctrl\+Shift\+R/i);
  assert.match(AVISO_ABA_DESATUALIZADA, /incompleto/i);
});

test("o aviso NÃO promete recarregar sozinho", () => {
  // Recarga automática no meio de uma importação de 781 anúncios mataria a
  // operação — e trocar de aba, coisa muito menor, já apagou uma mensagem de
  // resultado hoje. Quem decide quando recarregar é quem está usando.
  assert.doesNotMatch(AVISO_ABA_DESATUALIZADA, /recarregando|aguarde|autom[áa]tic/i);
});
