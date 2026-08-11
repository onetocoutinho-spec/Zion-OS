// INC-003 — a primeira ação de um turno é uma CONSULTA, e não uma frase.
//
// O caso que originou isto: o agente respondeu à Leilane que a Rasteira Vizzano
// tinha "2 variações sem peso", que o peso médio era "300 g" e que havia
// "preparado um cartão". O real era 3, 410 g e nenhuma proposta — e ele não
// chamou ferramenta nenhuma. O prompt já proibia; proibir não impede.
//
// A prova aqui é ESTRUTURAL, e é de propósito. Procurar "2", "300" ou "cartão"
// no texto fecharia a reprodução, não a classe: o modelo pode inventar sem
// dígito, e o operador pode citar um número legítimo. O que fecha a classe é
// não deixar o primeiro movimento ser texto.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../../testing/lerFonte.ts";
import {
  FERRAMENTAS,
  FERRAMENTAS_DE_ACAO,
  FERRAMENTAS_DE_LEITURA,
  FERRAMENTAS_DE_PROPOSTA,
  FERRAMENTAS_DE_RASCUNHO,
  PRIMEIRA_ACAO,
} from "./ferramentasDoAssistente.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => lerFonte(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA = semComentarios(ler("app/api/assistente/conversa/route.ts"));
const CLIENTE = semComentarios(ler("lib/agentes/conversaComFerramentas.ts"));

/**
 * Tudo que produz efeito — proposta persistida, rascunho gravado ou AÇÃO no
 * marketplace.
 *
 * DERIVADO de `efeito !== "le"`, e não somando listas à mão. A soma manual era
 * `PROPOSTA + RASCUNHO` e continuaria compilando, verde e silenciosa depois de
 * 03/08/2026 — deixando `reativar_anuncio`, a única ferramenta que age de
 * verdade, fora justamente do teste que existe para mantê-la fora do passo 0.
 *
 * Uma guarda que precisa de alguém lembrar de atualizá-la não é uma guarda.
 */
const COM_EFEITO = FERRAMENTAS.filter((f) => f.efeito !== "le").map((f) => f.nome);

// ---------------------------------------------------------------------------
// T2 · T3 — o conjunto da primeira ação
// ---------------------------------------------------------------------------

test("T2: a primeira ação admite exatamente as 11 ferramentas de leitura", () => {
  // As duas igualdades dizem coisas diferentes, e as duas importam: o número
  // trava o tamanho, e a comparação com FERRAMENTAS_DE_LEITURA trava a
  // IDENTIDADE — as dez são as que leem, não dez quaisquer.
  //
  // Este teste reprovou em 03/08/2026 e apontou o defeito certo: `executa`
  // dentro da lista de leitura. O conserto foi na fonte, não aqui.
  assert.equal(PRIMEIRA_ACAO.length, 11);
  assert.deepEqual([...PRIMEIRA_ACAO].sort(), [...FERRAMENTAS_DE_LEITURA.map((f) => f.nome)].sort());
  assert.equal(FERRAMENTAS_DE_ACAO.length, 1, "o catálogo ganhou ação sem passar por T3");
});

test("T2: são exatamente estas onze — a matriz que autorizou a decisão", () => {
  // A DÉCIMA PRIMEIRA entrou em 10/08/2026: `meus_custos`.
  //
  // Ela lê a configuração da PRÓPRIA lojista — margem mínima, imposto,
  // comissão do gestor, comissão do sistema, embalagem, etiqueta,
  // informativos, cupom. Sem escrita, sem chamada externa, sem custo, e o
  // tenant vem da sessão como nas outras dez.
  //
  // Por que ela pode ser a PRIMEIRA ação, que é a pergunta que esta matriz faz:
  // o pior caso de um "obrigado" disparando `meus_custos` é a lojista ver os
  // próprios custos sem ter pedido. É o mesmo dano de `estado_da_loja` — ou
  // seja, nenhum.
  //
  // E há razão para ela estar entre as primeiras: estes valores entram em TODA
  // conta de preço. Quando a lojista estranha um número, conferi-los ANTES de
  // investigar o produto é o caminho curto — e obrigá-la a uma pergunta
  // preliminar para chegar neles seria esconder a causa mais provável atrás de
  // um passo.
  assert.deepEqual([...PRIMEIRA_ACAO].sort(), [
    "achar_produto",
    "contar",
    "estado_da_loja",
    "meus_custos",
    "o_que_falta_no_produto",
    "o_que_impede",
    "pendencias",
    "preparacao_de_anuncio",
    "pricing",
    "procedencia",
    "proximo_passo",
  ]);
});

test("T3: NENHUMA das sete com efeito pode ser a primeira ação", () => {
  // Eram seis até 03/08/2026, e todas paravam num cartão à espera de clique. A
  // sétima é de outra natureza: `reativar_anuncio` não espera clique nenhum.
  //
  // O dano que o passo 0 passou a poder causar, portanto, subiu de nível. Antes,
  // o pior caso de um "obrigado" era um cartão indevido na tela de alguém. Agora
  // seria um ANÚNCIO NO AR sem ninguém ter pedido — reversível, sim, mas visível
  // para quem compra antes de ser visível para quem vende.
  assert.equal(COM_EFEITO.length, 10);
  for (const nome of COM_EFEITO) {
    assert.ok(
      !PRIMEIRA_ACAO.includes(nome),
      `"${nome}" tem efeito e entrou na primeira ação — um "obrigado" agiria sozinho`
    );
  }
});

test("T3: a lista é DERIVADA de `efeito`, não copiada à mão", () => {
  // Uma ferramenta nova classificada como `propoe` tem que ficar de fora
  // sozinha, sem ninguém lembrar de editar uma segunda lista.
  for (const nome of PRIMEIRA_ACAO) {
    assert.equal(FERRAMENTAS.find((f) => f.nome === nome)?.efeito, "le");
  }
});

test("PRIMEIRA_ACAO ⊂ nomes das 17", () => {
  const todas = new Set(FERRAMENTAS.map((f) => f.nome));
  for (const nome of PRIMEIRA_ACAO) assert.ok(todas.has(nome));
});

// ---------------------------------------------------------------------------
// T1 · T4 · T5 — a configuração por passo
// ---------------------------------------------------------------------------

test("T1: o passo 0 é `obrigado` com as leituras", () => {
  assert.match(ROTA, /passo === 0\s*\?\s*\{\s*modo:\s*"obrigado",\s*permitidas:\s*PRIMEIRA_ACAO\s*\}/);
});

test("T4: os passos seguintes são `livre`", () => {
  assert.match(ROTA, /:\s*\{\s*modo:\s*"livre"\s*\}/);
});

test("T1: `obrigado` FILTRA as ferramentas declaradas e obriga a chamar", () => {
  // MUDOU DE MECANISMO na migração para o Claude, e a mudança é deliberada.
  // O Gemini aceitava ANY + allowedFunctionNames ("chame, e só pode ser uma
  // DESTAS"). A Anthropic não tem esse meio-termo: `tool_choice` é auto, any
  // (QUALQUER uma) ou tool (UMA nomeada). Então a restrição saiu da escolha e
  // foi para a LISTA — o passo 0 declara só as leituras.
  //
  // A garantia fica mais forte: uma ferramenta de escrita não está sequer
  // declarada no primeiro passo, então não há configuração para "cair" e
  // deixá-la alcançável.
  assert.match(CLIENTE, /permitidas\.has\(f\.nome\)/);
  assert.match(CLIENTE, /tool_choice:\s*\{\s*type:\s*"any"\s*\}/);
});

test("T4: `livre` oferece todas e deixa o modelo decidir", () => {
  assert.match(CLIENTE, /tool_choice:\s*\{\s*type:\s*"auto"\s*\}/);
});

test("T5: lista e escolha saem da MESMA função — não dá para mandar tudo com `any`", () => {
  // Este é o teste que substitui o antigo "as 17 declarações em todo passo".
  // Agora que a restrição vive na lista, separar os dois deixaria possível
  // mandar a lista inteira com `any` — que é escrita alcançável no passo 0.
  assert.match(CLIENTE, /function ofertaDoPasso\(/);
  assert.match(CLIENTE, /\{\s*tools,\s*tool_choice\s*\}\s*=\s*ofertaDoPasso\(/);
  assert.match(ROTA, /FERRAMENTAS,/);
});

// ---------------------------------------------------------------------------
// T6 · T7 — a trajetória leitura → proposta continua viva
// ---------------------------------------------------------------------------

test("T6: o functionResponse da leitura volta ao modelo", () => {
  assert.match(ROTA, /respostas\.push\(\{\s*functionResponse:/);
  assert.match(ROTA, /historico\.push\(\{\s*role:\s*"user",\s*parts:\s*respostas\s*\}\)/);
});

test("T7: a restrição vale SÓ no passo 0 — depois a proposta é alcançável", () => {
  // Se a condição fosse por outra coisa que não `passo === 0`, a trajetória
  // leitura → proposta morreria e o C1R reprovaria.
  const ocorrencias = ROTA.match(/modo:\s*"obrigado"/g) ?? [];
  assert.equal(ocorrencias.length, 1, "a obrigação apareceu em mais de um lugar");
  assert.match(ROTA, /passo === 0\s*\?/);
});

// ---------------------------------------------------------------------------
// T9 · T10 · T12 — o que NÃO mudou
// ---------------------------------------------------------------------------

test("T10: o teto de passos continua 6", async () => {
  const { MAXIMO_DE_PASSOS } = await import("../../../lib/agentes/conversaComFerramentas.ts");
  assert.equal(MAXIMO_DE_PASSOS, 6);
});

test("T12: nenhuma ferramenta foi removida, acrescentada ou reclassificada sem decisão", () => {
  // Estes números são uma TRAVA, não uma descrição. Eles existem para que
  // acrescentar uma ferramenta seja um ato — alguém edita esta linha e explica.
  //
  // A trava disparou em 03/08/2026, com `reativar_anuncio`. Ela mudou de 16 para
  // 17 porque o dono decidiu que o chat pode agir, e a decisão está registrada
  // no tipo `Efeito` e em `EXECUCOES_REVERSIVEIS` — não porque o teste incomodou.
  //
  // A contagem por LISTA é o que dá sentido ao total: 17 sozinho passaria com
  // uma leitura virando proposta. As cinco linhas juntas dizem que o catálogo é
  // o mesmo, com um poder novo declarado no lugar certo.
  //
  // De 17 para 18 em 10/08/2026, e só a LEITURA subiu: `meus_custos`. O poder
  // de agir não mudou — continuam 1 rascunho, 5 propostas e 1 ação.
  //
  // A decisão: os custos do lojista e a margem mínima entram em toda conta de
  // preço do software e só se acertavam em duas telas. Quem não abrisse
  // nenhuma das duas recebia todo número calculado sobre valores que nunca
  // conferiu. Dar VOZ a eles não dá poder novo a ninguém — a troca continua
  // sendo em Configurações.
  //
  // De 18 para 20 em 10/08/2026: `propor_descricao` e `propor_palavras_chave`,
  // as duas PROPOSTA. Nenhuma leitura virou proposta e nenhuma proposta virou
  // ação — continuam 11 de leitura, 1 rascunho e 1 execução.
  //
  // A decisão: o chat melhorava o TÍTULO e não alcançava o resto do texto do
  // anúncio. Título é o que aparece na busca; descrição é o que o comprador lê
  // antes de comprar; palavra-chave é como ele chega. Faltavam dois terços do
  // mesmo anúncio.
  //
  // Elas gravam pela migração 057 — `copilot_executar_texto_do_anuncio`, a
  // MESMA disciplina atômica do título (048). Foram registradas aqui só depois
  // de a função existir em produção: uma ferramenta que monta proposta sem
  // cartão para confirmar é pior que uma ausente, porque a ausente o modelo diz
  // que não sabe e a inacabada ele anuncia como feita.
  //
  // De 20 para 21 em 11/08/2026: `propor_publicacao`, PROPOSTA.
  //
  // A decisão: era a última capacidade do portal fora do alcance do chat, e a
  // ÚNICA que muda o que o COMPRADOR vê. Por isso entrou por último, e por isso
  // é proposta e nunca ação: `reativar_anuncio` age sem clique porque o pior
  // caso dela é um anúncio dela mesma voltando ao ar; o pior caso desta é um
  // anúncio errado sendo visto por quem compra.
  //
  // Ela ENSAIA. O que ela devolve é o payload que a publicação real montaria
  // (`montarPreviewML`) — mostrar um resumo feito à parte seria mostrar uma
  // coisa e publicar outra.
  //
  // E não publica: quem publica é `/api/ml/publicar`, a MESMA rota da tela da
  // equipe, com a trava de infração que falha fechada. Um caminho próprio até o
  // ML seria uma segunda cópia daquela trava.
  assert.equal(FERRAMENTAS.length, 21);
  assert.equal(FERRAMENTAS_DE_LEITURA.length, 11);
  assert.equal(FERRAMENTAS_DE_RASCUNHO.length, 1);
  assert.equal(FERRAMENTAS_DE_PROPOSTA.length, 8);
  assert.equal(FERRAMENTAS_DE_ACAO.length, 1);
});

test("T12: o chat fala com o Claude", () => {
  assert.match(CLIENTE, /ANTHROPIC_MODELO_CONVERSA\s*\?\?\s*"claude-sonnet-5"/);
  assert.doesNotMatch(CLIENTE, /GEMINI_API_KEY|generativelanguage/);
});

test("T12: NENHUM parâmetro de amostragem — eles são 400 no Opus 5", () => {
  // Havia `temperature: 0` aqui, com o motivo certo ("a mesma frase deve levar
  // à mesma ferramenta"). No Opus 5 esse parâmetro é recusado com 400, então
  // reintroduzi-lo — inclusive tentando "restaurar o determinismo" — derruba
  // TODA requisição do chat, não uma. O substituto é `effort`.
  assert.doesNotMatch(CLIENTE, /\btemperature\s*:/);
  assert.doesNotMatch(CLIENTE, /\btop_p\s*:|\btop_k\s*:/);
  assert.match(CLIENTE, /effort:\s*ESFORCO/);
});

test("T12: o pensamento fica LIGADO — desligá-lo faz a ferramenta não rodar", () => {
  // Com pensamento desligado o Opus 5 às vezes escreve a chamada de ferramenta
  // como TEXTO em vez de emitir o bloco. O turno termina normalmente, a
  // ferramenta nunca roda, e não há erro nenhum para alguém ver — num chat que
  // só sabe responder a partir de ferramenta, isso é a falha mais cara possível.
  assert.match(CLIENTE, /thinking:\s*\{\s*type:\s*"adaptive"/);
  assert.doesNotMatch(CLIENTE, /type:\s*"disabled"/);
});

// ---------------------------------------------------------------------------
// T11 — defesa quando ANY não entrega chamada
// ---------------------------------------------------------------------------

test("T11: passo 0 sem chamada NÃO entrega o texto do modelo", () => {
  assert.match(ROTA, /passo === 0 && turno\.chamadas\.length === 0/);
  const bloco = ROTA.slice(ROTA.indexOf("passo === 0 && turno.chamadas.length === 0"));
  const ate = bloco.slice(0, bloco.indexOf("controlador.close()"));
  assert.ok(!ate.includes("turno.texto"), "o texto inventado vazou para a resposta");
});

test("T11: a frase de defesa não afirma nada sobre a loja", () => {
  const bloco = ROTA.slice(ROTA.indexOf("passo === 0 && turno.chamadas.length === 0"));
  const frase = bloco.slice(bloco.indexOf("texto:"), bloco.indexOf("falas:"));
  assert.ok(!/\d/.test(frase), "a frase de defesa tem número");
  for (const proibido of ["cartão", "produto", "pendência", "encontrei", "variaç"]) {
    assert.ok(!frase.toLowerCase().includes(proibido), `a frase afirma "${proibido}"`);
  }
});

// ---------------------------------------------------------------------------
// T8 · T9 — o cartão continua vindo do estado, não do texto
// ---------------------------------------------------------------------------

test("T8/T9: a proposta só atravessa COM id — texto nenhum cria cartão", () => {
  assert.match(ROTA, /proposta && propostaId \? \{ proposta, propostaId \}/);
  assert.match(ROTA, /escopoDoLote && propostaId/);
});

test("a correção não introduziu regex sobre a prosa do modelo", () => {
  // A fronteira é de protocolo. Se alguém acrescentar uma varredura textual
  // como enforcement, este teste é o lugar de discutir isso primeiro.
  const suspeitas = ROTA.match(/turno\.texto\.(match|includes|test|replace|search)/g) ?? [];
  assert.deepEqual(suspeitas, []);
});
