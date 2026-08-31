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

// ===========================================================================
// A QUINTA VEZ — 26/08/2026, e a primeira que GRAVOU DADO
// ===========================================================================
//
// A regra de decisão estava certa e o componente estava montado no layout
// raiz. Faltava GATILHO: ele conferia no carregamento e em
// `visibilitychange` — que só dispara quando a aba fica OCULTA.
//
// Trocar de JANELA não oculta a aba. Com o app numa janela e o terminal em
// outra, o detector conferiu uma vez, quando servidor e pacote ainda
// concordavam, e nunca mais. No meio disso uma importação de 1003 produtos
// entrou com o pacote velho e gravou 7224 variações com PESO ZERO — o campo
// de peso só existia no pacote novo.
//
// As quatro primeiras vezes foram tela errada. Esta foi BANCO errado.
//
// Os testes abaixo leem o fonte porque a regressão aqui é MUDA: tirar um
// ouvinte não quebra nada visível, e o detector volta a olhar uma vez só.

import { lerFonte } from "../../../testing/lerFonte.ts";

const FONTE_DO_AVISO = lerFonte(
  new URL("../../../components/layout/AvisoDeVersao.tsx", import.meta.url),
  "utf8"
);

test("o detector reconfere quando a JANELA volta ao foco", () => {
  assert.match(
    FONTE_DO_AVISO,
    /addEventListener\(\s*"focus"/,
    "sem `focus`, trocar de janela não reconfere — foi assim que a quinta vez aconteceu"
  );
});

test("o detector reconfere quando a ABA volta a aparecer", () => {
  assert.match(FONTE_DO_AVISO, /addEventListener\(\s*"visibilitychange"/);
});

test("o detector reconfere sozinho, para quem nunca sai da tela", () => {
  assert.match(
    FONTE_DO_AVISO,
    /setInterval\(\s*conferir/,
    "uma hora de tela aberta sem trocar de janela também atravessa deploy"
  );
});

test("os três gatilhos são desligados na saída", () => {
  // Ouvinte e relógio sobrevivendo ao componente é vazamento — e um relógio
  // vazado consulta a rota para sempre.
  assert.match(FONTE_DO_AVISO, /removeEventListener\(\s*"focus"/);
  assert.match(FONTE_DO_AVISO, /removeEventListener\(\s*"visibilitychange"/);
  assert.match(FONTE_DO_AVISO, /clearInterval/);
});

test("a trava de um minuto continua valendo para todos os gatilhos", () => {
  // O gatilho mudou; a frequência não. Sem a trava, três gatilhos viram três
  // consultas por gesto.
  assert.match(FONTE_DO_AVISO, /agora - ultima < ESPERA_ENTRE_CONSULTAS_MS/);
});
