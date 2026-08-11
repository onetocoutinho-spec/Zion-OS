import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// O chat tem DOIS caminhos e DOIS provedores: a via rápida classifica com
// Gemini Flash; o fio conversa com Anthropic e carrega as 22 ferramentas.
//
// ===========================================================================
// Medido em produção em 11/08/2026
// ===========================================================================
//
// A pergunta "melhore a descrição do anúncio da Sandália ... Ultra Ortopédica"
// voltou 502 de `/api/assistente` e a lojista leu "Não consegui entender
// agora. Tente de novo em instantes." A repetição idêntica, segundos depois,
// funcionou — falha transitória do provedor.
//
// A rota está certa: ela registra a causa no log e não vaza configuração do
// servidor para a tela. Errado era o CLIENTE tratar isso como fim de linha,
// tendo um segundo provedor de pé ao lado.
//
// Esta é a quarta porta de escalada. As outras três já existiam:
//   1. `!entendeu`                     — a frase não coube na lista fechada
//   2. `resposta.tipo === "nao_sei"`   — entendeu e não tinha balde
//   3. `proposta.tipo === "pronta"`    — precisa de autoridade do servidor
//   4. a classificação FALHOU          — esta
//
// Se o fio também cair, o erro dele sobe pelo catch de baixo: dois provedores
// fora do ar é uma parede de verdade, e aí a desculpa é honesta.

const FONTE = readFileSync(
  new URL("./ChatDaOperacao.tsx", import.meta.url),
  "utf8"
);
const CODIGO = FONTE.replace(/\/\*[\s\S]*?\*\//g, "").replace(
  /^\s*\/\/.*$/gm,
  ""
);

// `[^}]*` é deliberado onde um `[\s\S]*?` seria natural: preso ao corpo do
// `catch`, ele NÃO atravessa a chave de fechamento. Escrita com `[\s\S]{0,260}?`
// esta sentinela passou verde sobre o código quebrado — o casamento pulou o
// fim do catch e encontrou o `responderConversando` da PRIMEIRA porta de
// escalada, dez linhas abaixo. Uma sentinela que acha o vizinho não guarda
// nada.
const CORPO_DO_CATCH = /catch\s*\(\s*falhaDaViaRapida\s*\)\s*\{([^}]*)\}/;

test("a classificação que falha escala para o fio, em vez de virar desculpa", () => {
  assert.ok(
    CODIGO.includes("classificarPergunta(pergunta"),
    "a chamada à via rápida sumiu do chat"
  );

  const m = CORPO_DO_CATCH.exec(CODIGO);
  assert.ok(m, "o `try/catch` em volta da classificação sumiu");
  assert.match(
    m![1],
    /responderConversando\(pergunta\)/,
    "a via rápida voltou a ser fim de linha: quando o Gemini cai, a lojista " +
      "lê 'tente de novo' com o fio inteiro disponível ao lado"
  );
});

test("a escalada devolve o controle — não segue com um critério inválido", () => {
  const m = CORPO_DO_CATCH.exec(CODIGO);
  assert.ok(m, "o `try/catch` em volta da classificação sumiu");
  const corpo = m![1];
  const j = corpo.indexOf("responderConversando(pergunta)");
  assert.ok(j >= 0, "não há escalada no catch — o outro teste explica o custo");
  assert.match(
    corpo.slice(j),
    /return;/,
    "faltou o `return` depois de escalar — o código segue com `criterio` " +
      "não atribuído e estoura no primeiro acesso"
  );
});
