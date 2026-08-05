// A classificação de pergunta roda em esforço BAIXO.
//
// ===========================================================================
// O QUE ACONTECEU, E POR QUE ISTO É TESTE E NÃO COMENTÁRIO
// ===========================================================================
//
// Em 05/08/2026 a lojista digitou "o que falta no Moleca 5556?" e recebeu na
// tela:
//
//     ⚠️ Unexpected token '<', "<!DOCTYPE "... is not valid JSON
//
// A cadeia inteira: `/api/assistente` classifica a frase antes de a conversa
// começar. Ela chamava o modelo no esforço PADRÃO — que é alto — para decidir
// se a pergunta era sobre peso ou sobre preço. Estourou os 30s da rota, a
// plataforma devolveu uma PÁGINA HTML de erro, e o cliente tentou ler aquilo
// como JSON.
//
// Duas lições, e as duas viraram teste:
//
//   1. esforço alto numa tarefa trivial não sai mais lento — sai QUEBRADO;
//   2. `.json()` sem guarda transforma qualquer falha de infraestrutura num
//      erro de parser, que é a mensagem menos acionável possível.
//
// Estes testes leem a FONTE porque o que se guarda aqui é a configuração, e
// configuração não tem valor de retorno para inspecionar.

import { test } from "node:test";
import assert from "node:assert/strict";
import { lerFonte } from "../../../testing/lerFonte.ts";

const raiz = new URL("../../../", import.meta.url);
const ler = (rel: string) => lerFonte(new URL(rel, raiz), "utf8");
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ROTA = semComentarios(ler("app/api/assistente/route.ts"));
const CLIENTE = semComentarios(ler("lib/services/assistenteDaOperacao.ts"));
const PROVEDOR = semComentarios(ler("lib/agentes/provedorIA.ts"));

test("classificar uma frase roda em esforço BAIXO", () => {
  assert.match(ROTA, /esforco:\s*"low"/);
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
  // Os outros cinco pontos de chamada não passam esforço e devem continuar no
  // padrão da API. Mandar a chave com undefined é outra coisa.
  assert.match(PROVEDOR, /\.\.\.\(c\.esforco\s*\?\s*\{\s*effort:\s*c\.esforco\s*\}\s*:\s*\{\}\)/);
});

test("a leitura da resposta da classificação tem guarda contra HTML", () => {
  // `.json()` sem `.catch` foi o que pôs "Unexpected token '<'" na tela.
  assert.match(CLIENTE, /resposta\.json\(\)\.catch\(/);
  assert.doesNotMatch(
    CLIENTE,
    /const dados = \(await resposta\.json\(\)\) as/,
    "voltou o `.json()` sem guarda"
  );
});

test("a mensagem de falha da classificação é acionável", () => {
  // "Tente de novo" é acionável. Um erro de parser não é.
  assert.match(CLIENTE, /Tente de novo/);
});
