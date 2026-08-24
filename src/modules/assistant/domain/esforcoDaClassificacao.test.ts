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

test("classificar uma frase roda em esforço BAIXO, num modelo próprio", () => {
  // Era `low`. Em 24/08/2026, primeiro dia no ChatGPT, a mesma lição de 05/08
  // apareceu de novo com outra cara: no gpt-5, `low` gastou 9,5s e 630 tokens
  // de saída para classificar UMA frase — raciocínio quase todo — e a lojista
  // esperava isso ANTES de o chat começar a responder.
  //
  // A decisão: a tarefa é barata e tem que ser paga como barata. A linha
  // `classificacao` da tabela roda no gpt-5-mini — com o gpt-5 de RESERVA,
  // porque cair por sobrecarga não pode piorar a classificação que decide a
  // resposta inteira.
  //
  // FOI `minimal` por algumas horas em 24/08/2026, e voltou para `low` no
  // mesmo dia: com esforço mínimo o classificador mandou "confere as variações
  // da Papete, parece que os anúncios não estão agrupados" para `estado_geral`,
  // e a lojista leu "sua loja está em dia" numa loja com 303 anúncios fora do
  // ar. Escolher entre sete intenções não é trivial como parecia — e no mini,
  // `low` custa ~2,5 s.
  //
  // O que ficou de `minimal` é o ROTEADOR DE ESPECIALISTA (na rota da
  // conversa): lá a escolha é entre nove nomes descritos, e errar cai no
  // `geral`, que tem tudo.
  assert.match(ROTA, /esforco:\s*"low"/);
  assert.match(ROTA, /tarefa:\s*"classificacao"/);
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
  //
  // A FORMA mudou em 24/08/2026 — `minimal` é palavra da OpenAI e o caminho
  // Anthropic a traduz para `low` — mas a garantia é a mesma: sem esforço,
  // sem chave.
  assert.match(
    PROVEDOR,
    /\.\.\.\(c\.esforco\s*\?\s*\{\s*effort:\s*c\.esforco === "minimal" \? "low" : c\.esforco\s*\}\s*:\s*\{\}\)/
  );
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

test("o caminho barato DECLARA que não cobre o Mercado Livre — e devolve a pergunta", () => {
  // O DEFEITO MEDIDO EM 24/08/2026, e o mais grave da semana.
  //
  // "Confere as variações da Papete Slide Modare 7208.101 Nobuck, parece que
  // tem anúncios desse produto que não estão agrupados" foi classificada como
  // `estado_geral` e respondida NO CLIENTE, sem tocar em ferramenta nenhuma:
  //
  //     ✓ Nada travado. Sua loja está em dia.
  //
  // Numa loja com 303 anúncios fora do ar, 148 esperando correção do ML, e
  // essa Papete com 16 anúncios e 1 ativo.
  //
  // A causa não é só o modelo ter errado: o caminho barato tem sete intenções
  // de uma era ANTERIOR às ferramentas de marketplace, e ele intercepta
  // perguntas que hoje têm ferramenta própria (`anuncios_ativos`,
  // `anuncios_a_corrigir`, `diagnostico_de_agrupamento`). Uma capacidade que
  // existe e não é alcançada é uma capacidade que não existe.
  //
  // O conserto é o classificador declarar o próprio limite e devolver a
  // pergunta para a conversa, que tem as ferramentas.
  assert.match(ROTA, /O QUE ESTA LISTA NÃO COBRE/);
  assert.match(ROTA, /ANÚNCIO, MERCADO LIVRE, VARIAÇÃO, AGRUPAMENTO/);
  assert.match(ROTA, /nomeia um produto específico e pede uma análise dele/);
  // E `estado_geral` passa a dizer que é do CADASTRO, não da loja inteira.
  assert.match(ROTA, /panorama do CADASTRO/);
  assert.match(ROTA, /um pedido sobre UM produto nunca é panorama da loja/);
});
