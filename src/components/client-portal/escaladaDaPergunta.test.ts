// TODA PERGUNTA VAI PARA A CONVERSA.
//
// ===========================================================================
// O QUE ESTE ARQUIVO GUARDAVA ANTES, E POR QUE MUDOU
// ===========================================================================
//
// Havia aqui um portão com duas portas de escalada: uma classificação barata
// decidia a intenção e, para seis assuntos, a resposta era montada NO CLIENTE
// contra o estado que a tela já tinha carregado; só o que não coubesse na
// lista fechada seguia para a conversa. As duas portas foram construídas em
// 03/08 e 10/08/2026, e as duas eram remendos no mesmo lugar.
//
// O portão foi APOSENTADO em 24/08/2026, por duas medições em produção:
//
//   1. ELE ERRAVA, do jeito pior. "Confere as variações da Papete, parece que
//      os anúncios não estão agrupados" foi classificada como panorama da loja
//      e respondida com "Nada travado. Sua loja está em dia." — numa loja com
//      303 anúncios fora do ar. A lista fechada é de uma era ANTERIOR às
//      ferramentas de marketplace, e interceptava perguntas que hoje têm
//      ferramenta própria.
//
//   2. ELE DEIXOU DE SER BARATO. Às 16:48 daquele dia: a classificação custou
//      8,1 s e o CHAT INTEIRO, com ferramenta e tudo, custou 5,3 s. O portão
//      que existe para economizar passou a custar mais que o que ele evita —
//      porque o chat desceu para o gpt-5-mini e ficou 20× mais rápido.
//
// O que este arquivo guarda agora é o inverso do que guardava: que NÃO existe
// caminho paralelo. Uma capacidade nova nasce alcançável porque só há um
// caminho — e era exatamente isso que as duas portas tentavam remendar.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../testing/lerFonte.ts";

const FONTE = lerFonte(new URL("./ChatDaOperacao.tsx", import.meta.url), "utf8");
// `perguntar` é um `useCallback`; o corpo vai daí até a função seguinte.
const CORPO_DE_PERGUNTAR = FONTE.slice(
  FONTE.indexOf("const perguntar = useCallback("),
  FONTE.indexOf("Grava — só a partir de uma proposta")
);

test("não há classificador: a pergunta vai direto para a conversa", () => {
  assert.doesNotMatch(FONTE, /classificarPergunta/, "o portão voltou");
  assert.doesNotMatch(FONTE, /assistenteDaOperacao/, "o cliente da rota barata voltou");
  // E o único caminho de saída de `perguntar`, tirando a saudação, é o fio.
  assert.match(CORPO_DE_PERGUNTAR, /await responderConversando\(pergunta\);/);
});

test("a resposta NÃO é mais montada no cliente", () => {
  // `responder()` é do domínio e continua vivo — mas quem o chama agora é a
  // FERRAMENTA (`contar`, `estado_da_loja`, `proximo_passo`), no servidor, e
  // não a tela. Os números continuam vindo do domínio; o caminho é que mudou.
  assert.doesNotMatch(FONTE, /\bresponder\(criterio/, "a tela voltou a responder sozinha");
  assert.doesNotMatch(FONTE, /interpretacao: criterio\.interpretacao/);
});

test("ditar um valor também vai para a conversa — `propor_gravacao` faz o cartão", () => {
  // Era o único ramo que não escalava: `preencher` virava proposta montada na
  // tela. A ferramenta `propor_gravacao` faz o mesmo cartão, com o tenant do
  // servidor e a Proposal persistida — que é onde a autorização deve nascer.
  assert.doesNotMatch(CORPO_DE_PERGUNTAR, /montarProposta\(/);
});

test("a saudação continua sem rede — 'oi' não vale uma chamada de modelo", () => {
  assert.match(CORPO_DE_PERGUNTAR, /if \(ehSaudacao\(pergunta\)\)/);
  // O ÚLTIMO `responderConversando` é a saída padrão. O primeiro é o modo
  // "manter o fio", em que a pessoa já escolheu conversar — e aí nem a
  // saudação intercepta, porque ela está no meio de um assunto.
  const antesDaConversa = CORPO_DE_PERGUNTAR.lastIndexOf("await responderConversando(pergunta);");
  const saudacao = CORPO_DE_PERGUNTAR.indexOf("if (ehSaudacao(pergunta))");
  assert.ok(saudacao > 0 && saudacao < antesDaConversa, "a saudação precisa vir antes do fio");
});

test("a decisão está escrita onde alguém vai procurar", () => {
  // O próximo a ler este arquivo vai querer saber por que não há um caminho
  // rápido. A resposta é uma medição, não uma preferência.
  assert.match(CORPO_DE_PERGUNTAR, /O CAMINHO BARATO FOI APOSENTADO EM 24\/08\/2026/);
  assert.match(CORPO_DE_PERGUNTAR, /8,1 s/);
  assert.match(CORPO_DE_PERGUNTAR, /5,3 s/);
});
