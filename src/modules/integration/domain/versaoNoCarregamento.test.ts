// O aviso de versão no CARREGAMENTO, não só depois de uma operação.
//
// ===========================================================================
// AS QUATRO VEZES
// ===========================================================================
//
// 01–02/08/2026, sempre a mesma aba atravessando um deploy:
//
//  1. a importação de 279 anúncios gravou ZERO estado de marketplace;
//  2. a atualização de estado dos 502 não rodou;
//  3. a linha de "campos exigidos" não apareceu, e não dava para dizer se era
//     ausência de defeito ou ausência de código;
//  4. o botão "O que o ML manda" não estava na tela, já estando no ar.
//
// O detector anterior viajava na resposta de `/api/ml/importar-anuncios` e só
// falava DEPOIS de uma importação. O caso 4 ele não pegava: abrir a tela e não
// achar um botão não é uma operação.
//
// A regra de decisão é a MESMA dos dois lugares — é o gatilho que muda. Este
// arquivo prova que a regra continua valendo nos casos que o carregamento
// acrescenta.

import test from "node:test";
import assert from "node:assert/strict";
import { abaDesatualizada, AVISO_ABA_DESATUALIZADA } from "./abaDesatualizada.ts";

test("o caso 4: pacote antigo, servidor novo, NENHUMA operação rodada", () => {
  // É o que aconteceu na tela de Produtos: quatro cards em vez de cinco.
  assert.equal(abaDesatualizada({ doNavegador: "ec5a706", doServidor: "724a252" }), true);
});

test("rota `/api/versao` ausente (servidor antigo) NÃO acusa a aba", () => {
  // Um 404 vira `doServidor: undefined`. Se isso acusasse, TODA aba pareceria
  // velha no primeiro deploy depois desta mudança — alarme falso em massa,
  // logo no dia em que o alarme estreia.
  assert.equal(abaDesatualizada({ doNavegador: "abc", doServidor: undefined }), false);
});

test("rede fora não é versão velha", () => {
  // O componente engole o erro e não chama a decisão. Aqui fica registrado o
  // contrato: sem resposta, sem aviso.
  assert.equal(abaDesatualizada({ doNavegador: "abc", doServidor: "" }), false);
});

test("ambiente local nunca avisa — os dois lados leem `dev`", () => {
  assert.equal(abaDesatualizada({ doNavegador: "dev", doServidor: "dev" }), false);
});

test("a frase é a MESMA dos dois gatilhos", () => {
  // Duas frases para o mesmo fato ensinariam que são problemas diferentes.
  assert.match(AVISO_ABA_DESATUALIZADA, /recarregue/i);
  assert.match(AVISO_ABA_DESATUALIZADA, /Ctrl\+Shift\+R/i);
});

test("o aviso continua sem prometer recarga automática", () => {
  // Recarregar sozinho no meio de uma importação de 781 anúncios mataria a
  // operação. Vale para o banner tanto quanto valia para a faixa.
  assert.doesNotMatch(AVISO_ABA_DESATUALIZADA, /recarregando|aguarde|autom[áa]tic/i);
});
