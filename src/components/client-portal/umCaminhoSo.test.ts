import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// O CHAT TEM UM CAMINHO SÓ — e este arquivo é o destino das sentinelas que
// guardavam a escada entre os dois.
//
// ===========================================================================
// O QUE FOI APOSENTADO, E POR QUÊ — 17/08/2026
// ===========================================================================
//
// Havia duas portas até a resposta: um classificador com lista fechada de
// assuntos, que respondia pelo domínio no navegador, e o fio das 24
// ferramentas. Cinco sentinelas guardavam a escada entre elas (`escalada
// DaPergunta`) e duas guardavam a queda da via rápida (`viaRapidaQueCai`).
//
// A via "rápida" deixou de ser rápida e deixou de ser barata. Medido:
//
//   · roda em `claude-opus-5`; o fio roda em `claude-sonnet-5`
//   · uma pergunta simples levou 5,9s NELA, sem escalar nenhuma vez
//   · 4 chamadas na janela medida, ZERO escaladas
//
// E custava correção: a ferramenta `fotos_do_produto`, nascida na mesma
// semana, foi SOMBREADA — "preciso fotografar este produto?" caiu na lista
// fechada e respondeu `o_que_falta_no_produto`. Duas listas fechadas
// disputando a mesma frase é defeito estrutural: toda ferramenta nova entra na
// disputa, e ganha quem foi escrita primeiro.
//
// ===========================================================================
// PARA ONDE FOI CADA PROPRIEDADE
// ===========================================================================
//
// · "PORTA 1", "PORTA 2", "a escalada acontece ANTES da resposta na tela",
//   "a escalada devolve o controle", "a classificação que falha escala":
//   as cinco garantiam que a pergunta CHEGASSE ao fio. Com um caminho só, ela
//   chega sempre — a propriedade virou a primeira prova deste arquivo.
//
// · "a janela da decisão não está vazia": era âncora de um trecho que não
//   existe mais.
//
// · "PREENCHER vira proposta, não vira pergunta": a ÚNICA comportamental, e a
//   que segurou a unificação por meia sessão. Ver a segunda prova.
//
// · "o domínio continua tendo os quatro `nao_sei`" e "a auditoria só aparece
//   quando o software NÃO entregou": não falavam da escada. Ficaram onde
//   estavam.

const CHAT = readFileSync(new URL("./ChatDaOperacao.tsx", import.meta.url), "utf8");
// O fluxo da pergunta é inline no componente, sem função nomeada — então a
// prova é sobre o ARQUIVO. É mais forte: um classificador reintroduzido em
// qualquer lugar dele reprova.
const SEM_COMENTARIOS = CHAT.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("toda pergunta vai para o fio — não existe segunda porta", () => {
  assert.match(SEM_COMENTARIOS, /await responderConversando\(pergunta\);/);
  assert.ok(
    !/classificarPergunta\(/.test(SEM_COMENTARIOS),
    "voltou a existir um classificador antes do fio — e com ele a disputa entre " +
      "duas listas fechadas, que sombreia toda ferramenta nova"
  );
  assert.ok(
    !/\bresponder\(criterio/.test(SEM_COMENTARIOS),
    "voltou a existir resposta montada no navegador, fora do fio"
  );
});

test("DITAR UM VALOR continua virando cartão, não conversa", () => {
  // A ÚNICA propriedade comportamental que a escada guardava, e a que segurou
  // esta unificação por meia sessão.
  //
  // "o chinelo pesa 300 g" é a lojista INFORMANDO. Isso nunca pode virar um
  // parágrafo: o cartão de confirmação é a única garantia de que nada entra no
  // catálogo dela sem alguém ler e clicar.
  //
  // No caminho apagado, a garantia era o classificador devolver
  // `intencao === "preencher"` e o domínio montar a proposta ali mesmo. No
  // fio, ela tem três pernas, e as três são verificadas abaixo:
  //
  //   1. a ferramenta existe e NÃO executa — `propor_gravacao` é `propoe`
  //   2. o prompt manda usá-la, e proíbe inventar valor que ela não disse
  //   3. o alvo é travado em CÓDIGO: sem casamento único não sai `id`, então
  //      gravar no produto errado deixou de ser possível
  //
  // A falha que sobra é "não faz", não "faz errado": se o modelo não chamar a
  // ferramenta, nada é gravado e ela repete a frase. Foi isso que tornou
  // seguro apagar a porta.
  const rota = readFileSync(
    new URL("../../app/api/assistente/conversa/route.ts", import.meta.url),
    "utf8"
  );
  const ferramentas = readFileSync(
    new URL("../../modules/assistant/domain/ferramentasDoAssistente.ts", import.meta.url),
    "utf8"
  );
  const executor = readFileSync(
    new URL("../../modules/assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );

  // 1. a ferramenta propõe, não executa
  const i = ferramentas.indexOf('nome: "propor_gravacao"');
  assert.ok(i > 0, "`propor_gravacao` sumiu do catálogo");
  assert.match(
    ferramentas.slice(i, i + 200),
    /efeito: "propoe"/,
    "`propor_gravacao` foi reclassificada — ela NÃO pode executar"
  );

  // 2. o prompt manda usá-la e proíbe inventar o valor
  assert.match(rota, /propor_gravacao/, "o prompt parou de citar a ferramenta");
  assert.match(
    rota,
    /Nunca proponha um valor que o lojista não disse nesta conversa/,
    "sumiu a proibição de inventar o valor ditado"
  );

  // 3. o alvo é travado em código
  assert.match(
    executor,
    /if \(achados\.length > 1\)/,
    "a trava da ambiguidade sumiu — o modelo voltaria a poder escolher o produto"
  );
});

test("o cartão continua exigindo clique — nada grava sozinho", () => {
  // `propor_gravacao` devolve `proposta` para a TELA e só um `resumo` para o
  // modelo. Quem executa é o clique, com o objeto que a tela tem — o modelo
  // nunca recebe o que grava.
  const executor = readFileSync(
    new URL("../../modules/assistant/domain/executarFerramenta.ts", import.meta.url),
    "utf8"
  );
  const i = executor.indexOf('case "propor_gravacao"');
  const corpo = executor.slice(i, executor.indexOf('case "propor_anuncio"', i));
  assert.match(corpo, /montarProposta\(/, "a proposta deixou de nascer no domínio");
  assert.match(
    corpo,
    /proposta\.tipo === "pronta"[\s\S]{0,120}resumo: proposta\.resumo/,
    "o modelo passou a receber mais que o resumo da proposta"
  );
});
