// A trava da fila — a que o comentário dizia existir e não existia.
//
// ===========================================================================
// O DEFEITO
// ===========================================================================
//
// O worker escolhia o lote assim:
//
//     select ... .eq("status", "pendente").limit(N)      <- lê
//     update({ status: "processando" }).in("id", ids)    <- escreve
//
// Um TOCTOU. Entre a leitura e a escrita, outra execução lê a MESMA linha. O
// `update` não dizia `where status = 'pendente'` e ninguém olhava quais linhas
// tinham sido de fato tomadas — as duas escritas davam certo, e as duas
// execuções seguiam com o mesmo produto.
//
// O comentário no lugar já descrevia o estrago com precisão: "o orçamento é de
// 250s e o cron dispara a cada 60s — até quatro execuções se sobrepõem. Sem a
// trava, todas selecionam os mesmos `pendente` e rodam a esteira sobre o mesmo
// produto." Ele descrevia o código que estava logo abaixo dele.
//
// MEDIDO em 27/08/2026 contra o staging, seis execuções simultâneas rodando o
// par exato do worker:
//
//     6 execuções · 6 travaram · 1 item DISTINTO
//
// As seis pegaram a mesma linha. Em produção: o cron pagando quatro vezes pelo
// mesmo anúncio e gravando quatro cópias dele — 24.000 tokens de saída cada.
//
// Com o `eq("status","pendente")` dentro do UPDATE e o `select()` devolvendo o
// que foi tomado, a mesma medição, 5 rodadas × 8 simultâneas:
//
//     40 tentativas · 5 itens travados · 35 perderam · 0 com mais de um dono
//
// ===========================================================================
// POR QUE SENTINELA
// ===========================================================================
//
// A corrida não se reproduz em teste unitário: ela vive no intervalo entre dois
// round-trips ao Postgres, e o que a fecha é o row lock do banco sob READ
// COMMITTED. Um mock não tem row lock — provaria a asserção, não o conserto.
//
// O que se guarda aqui é a ESTRUTURA que torna o row lock utilizável: a
// condição de status dentro do UPDATE, o `select()` que diz quem ganhou, e o
// processamento seguindo `travados` em vez de `lote`. Tirar qualquer uma das
// três devolve a corrida sem quebrar nada visível.
//
// Rodar: npx tsx --test src/app/api/otimizar/worker/aTravaDaFilaTrava.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "@/testing/lerFonte";

const FONTE = lerFonte(new URL("./route.ts", import.meta.url));

/** O UPDATE que reivindica o lote, do `await admin` ao `.select(...)`. */
function reivindicacao(): string {
  const i = FONTE.indexOf('.update({ status: "processando" })');
  assert.notEqual(i, -1, "o UPDATE que trava o lote sumiu");
  const inicio = FONTE.lastIndexOf("await admin", i);
  const fim = FONTE.indexOf(";", i);
  assert.ok(inicio !== -1 && fim > i, "não achei os limites do UPDATE");
  return FONTE.slice(inicio, fim);
}

test("o UPDATE que trava exige `pendente` — é ele que faz o Postgres serializar", () => {
  // Sem esta condição o segundo UPDATE grava por cima do primeiro e os dois
  // seguem. Com ela, o segundo reavalia o WHERE contra a versão já gravada,
  // vê `processando` e não casa.
  assert.match(reivindicacao(), /\.eq\("status",\s*"pendente"\)/);
});

test("a reivindicação DEVOLVE as linhas tomadas — sem isso não há como saber quem ganhou", () => {
  // `update` sem `select` devolve `data: null`. O worker não teria como
  // distinguir "tomei 3" de "perdi as 3".
  assert.match(reivindicacao(), /\.select\(/);
});

test("quem roda a esteira é `travados`, NUNCA `lote`", () => {
  // Esta é a linha que transforma a informação em comportamento. Com o CAS
  // certo e `lote` aqui, a corrida volta inteira e o teste acima passaria.
  assert.match(FONTE, /processarUm\(admin,\s*f,\s*cacheTabelas\)/);
  const i = FONTE.indexOf("Promise.all(");
  const chamada = FONTE.slice(i, FONTE.indexOf(";", i));
  assert.match(chamada, /travados\.map/);
  assert.doesNotMatch(chamada, /\blote\.map/, "voltou a processar `lote` — a corrida está de volta");
});

test("perder a disputa não é erro: continua, não quebra o ciclo", () => {
  // Perder é o caso NORMAL quando várias execuções se sobrepõem — foi o que a
  // medição mostrou (35 de 40). Tratar como falha faria a fila parar de andar
  // justamente quando há mais gente trabalhando nela.
  const i = FONTE.indexOf("travados.length === 0");
  assert.notEqual(i, -1, "o caso 'não travei nada' deixou de ser tratado");
  const bloco = FONTE.slice(i, i + 800);
  assert.match(bloco, /continue;/);
  assert.doesNotMatch(bloco.slice(0, bloco.indexOf("continue;")), /falhas\+\+/);
});

test("o laço não gira em falso: há limite para perdas seguidas", () => {
  // Fila curta com muitas execuções perderia sempre, e as 250s do orçamento
  // sairiam em ida e volta ao banco sem gerar anúncio nenhum.
  assert.match(FONTE, /MAX_PERDIDAS/);
  assert.match(FONTE, /perdidasSeguidas/);
  assert.match(FONTE, /if \(\+\+perdidasSeguidas >= MAX_PERDIDAS\) break;/);
});

test("o contador zera ao ganhar — senão ele soma perdas de ciclos distintos", () => {
  const i = FONTE.indexOf("if (++perdidasSeguidas >= MAX_PERDIDAS) break;");
  assert.match(FONTE.slice(i, i + 400), /perdidasSeguidas = 0;/);
});
