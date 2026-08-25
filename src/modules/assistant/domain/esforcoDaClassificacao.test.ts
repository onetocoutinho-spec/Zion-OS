// AS LIÇÕES DA CLASSIFICAÇÃO — que sobreviveram à rota que as ensinou.
//
// ===========================================================================
// A ROTA MORREU; O QUE ELA ENSINOU, NÃO
// ===========================================================================
//
// `/api/assistente` classificava a intenção de uma frase antes de a conversa
// começar. Ela foi APOSENTADA em 24/08/2026 — o portão que existia para ser
// barato passou a custar 8,1 s enquanto o chat inteiro custava 5,3 s, e a lista
// fechada de assuntos interceptava perguntas que já tinham ferramenta própria
// (ver `escaladaDaPergunta.test.ts`).
//
// Este arquivo guardava três coisas. Uma morreu com ela; duas continuam vivas
// em outros lugares, e é por isso que ele continua existindo em vez de ser
// apagado — o incidente que as ensinou não fica mais fácil de reconstruir
// depois que o arquivo some.
//
// O QUE ACONTECEU, em 05/08/2026: a lojista digitou "o que falta no Moleca
// 5556?" e recebeu na tela:
//
//     ⚠️ Unexpected token '<', "<!DOCTYPE "... is not valid JSON
//
// A classificação chamava o modelo no esforço PADRÃO — que é alto — para
// decidir se a pergunta era sobre peso ou sobre preço. Estourou os 30 s da
// rota, a plataforma devolveu uma PÁGINA HTML de erro, e o cliente tentou ler
// aquilo como JSON.
//
// Duas lições, e as duas continuam guardadas abaixo:
//
//   1. esforço alto numa tarefa trivial não sai mais lento — sai QUEBRADO, e
//      o `effort` precisa chegar onde a API o lê;
//   2. `.json()` sem guarda transforma qualquer falha de infraestrutura num
//      erro de parser, que é a mensagem menos acionável possível.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../../testing/lerFonte.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => lerFonte(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const PROVEDOR = semComentarios(ler("lib/agentes/provedorIA.ts"));
const CONVERSA = semComentarios(ler("lib/services/conversaDoAssistente.ts"));

test("a rota de classificação não voltou por uma porta lateral", () => {
  // Um caminho paralelo que responde sem ferramenta é a classe de defeito que
  // a aposentadoria fechou. Se ele voltar, que volte por decisão escrita.
  assert.throws(
    () => ler("app/api/assistente/route.ts"),
    "a rota de classificação foi recriada — ver escaladaDaPergunta.test.ts"
  );
});

test("o esforço chega à API como `effort` dentro de output_config", () => {
  // Fora de `output_config` ele é ignorado em silêncio — a pior forma de errar
  // isto, porque nada quebra e a lentidão continua.
  //
  // A asserção é COLADA no `format`, e não um trecho largo: a primeira versão
  // deste teste usava `output_config:[\s\S]{0,200}?effort` e o mutante que
  // move `effort` para FORA do bloco passou por ela — a janela de 200 chars
  // atravessava a chave de fechamento. Teste que não falha não é teste.
  assert.match(
    PROVEDOR,
    /format:\s*\{\s*type:\s*"json_schema",\s*schema:\s*c\.schema\s*\},\s*\.\.\.\(c\.esforco/
  );
});

test("omitir o esforço não manda `effort: undefined`", () => {
  // Quem não passa esforço deve continuar no padrão da API. Mandar a chave com
  // undefined é outra coisa.
  //
  // A FORMA mudou em 24/08/2026 — `minimal` é palavra da OpenAI e o caminho
  // Anthropic a traduz para `low` — mas a garantia é a mesma: sem esforço,
  // sem chave.
  assert.match(
    PROVEDOR,
    /\.\.\.\(c\.esforco\s*\?\s*\{\s*effort:\s*c\.esforco === "minimal" \? "low" : c\.esforco\s*\}\s*:\s*\{\}\)/
  );
});

test("a leitura da resposta do chat tem guarda contra HTML", () => {
  // `.json()` sem `.catch` foi o que pôs "Unexpected token '<'" na tela. A
  // rota que sofreu isso não existe mais; a guarda mora hoje no cliente da
  // CONVERSA, que é por onde toda pergunta passa desde 24/08/2026.
  assert.match(CONVERSA, /resposta\.json\(\)\.catch\(/);
  assert.doesNotMatch(
    CONVERSA,
    /const dados = \(await resposta\.json\(\)\) as/,
    "voltou o `.json()` sem guarda"
  );
});

test("a mensagem de falha do chat é acionável", () => {
  // "Tente de novo" é acionável. Um erro de parser não é.
  assert.match(CONVERSA, /Tente de novo|interrompida no meio/);
});
