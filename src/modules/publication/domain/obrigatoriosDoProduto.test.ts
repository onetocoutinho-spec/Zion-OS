// A lista certa para cada produto — e o que acontece quando não se sabe.
//
// As duas metades que precisam de prova, e são as do INC-011:
//
//   1. um produto de MLB23332 cobrado pela lista DELA não recebe pergunta de
//      tipo de calçado — o atributo nem existe naquela categoria, e a pergunta
//      travava a preparação de 94 anúncios;
//   2. categoria desconhecida sai IDÊNTICA ao de antes. São 674 anúncios em
//      calçado e a generalização não pode cobrar deles nada novo, nem deixar de
//      cobrar o que já cobrava.
//
// Rodar: npx tsx --test src/modules/publication/domain/obrigatoriosDoProduto.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { obrigatoriosDoProduto } from "./obrigatoriosDoProduto.ts";
import {
  exigenciasDaResposta,
  OBRIGATORIOS_CALCADO,
  type AtributoCruDoML,
  type ExigenciaDaCategoria,
} from "./atributosDoMarketplace.ts";
import { avaliarPreparacao, type ProdutoParaPreparar } from "./preparacaoDoAnuncio.ts";

const fixture = (nome: string) =>
  exigenciasDaResposta(
    JSON.parse(
      readFileSync(new URL(`../../../testing/fixtures/${nome}`, import.meta.url), "utf8")
    ) as AtributoCruDoML[]
  );

const MLB23332 = fixture("mlb23332-atributos.json");
const MLB273770 = fixture("mlb273770-atributos.json");

/**
 * Uma sapatilha da conta: cadastro completo, nome que NÃO diz o tipo.
 *
 * É o caso dos 26 produtos medidos em 11/08 — o nome não carrega a palavra, e
 * `tipoDeCalcadoDoNome` devolve null. Em calçado isso é pendência legítima; em
 * MLB23332 é pergunta sobre um campo que não existe.
 */
const SAPATILHA: ProdutoParaPreparar = {
  id: "p1",
  nome: "Modare 7016.461 Napa Floater Nature",
  marca: "Modare",
  modelo: "7016.461",
  custo: 30,
  precoVenda: 99,
  pesoGramas: 300,
  alturaCm: 10,
  larguraCm: 20,
  comprimentoCm: 30,
  quantidadeImagens: 3,
  variantes: [{ cor: "Nude", tamanho: "37" }],
};

/** A etapa que o INC-011 estraga: é ela que trava a preparação. */
const identidade = (p: ProdutoParaPreparar, obrigatorios: readonly ExigenciaDaCategoria[]) =>
  avaliarPreparacao(p, null, { obrigatorios }).etapas.find((e) => e.etapa === "identidade");

// ---------------------------------------------------------------------------
// A ESCOLHA DA LISTA
// ---------------------------------------------------------------------------

test("categoria conhecida com lista: manda a lista da categoria", () => {
  const r = obrigatoriosDoProduto("MLB23332", MLB23332);
  assert.equal(r.procedencia, "categoria");
  assert.equal(r.categoria, "MLB23332");
  assert.deepEqual(
    r.exigencias.map((e) => e.id),
    ["BRAND", "MODEL", "GENDER", "COLOR", "SIZE"]
  );
});

test("categoria desconhecida: calçado, dito como palpite", () => {
  const r = obrigatoriosDoProduto(null, null);
  assert.equal(r.procedencia, "palpite");
  assert.equal(r.categoria, null);
  assert.equal(r.exigencias, OBRIGATORIOS_CALCADO);
});

test("lista VAZIA não é 'não exige nada' — é o ML que não respondeu", () => {
  // `atributosObrigatorios` devolve [] quando a rede ou o ML falham. Aceitar
  // esse vazio liberaria publicação sem ficha nenhuma, que é pior do que pedir
  // um campo a mais.
  const r = obrigatoriosDoProduto("MLB23332", []);
  assert.equal(r.procedencia, "palpite");
  assert.equal(r.exigencias, OBRIGATORIOS_CALCADO);
});

test("categoria em branco com lista também cai no palpite", () => {
  assert.equal(obrigatoriosDoProduto("   ", MLB23332).procedencia, "palpite");
});

// ---------------------------------------------------------------------------
// O EFEITO NA PREPARAÇÃO — as duas metades do INC-011
// ---------------------------------------------------------------------------

test("MLB23332 não pergunta Tipo de calçado — o atributo não existe lá", () => {
  // Nem obrigatório, nem opcional: a categoria inteira não tem esse campo.
  assert.equal(
    MLB23332.some((e) => e.id === "FOOTWEAR_TYPE"),
    false
  );
  const daCategoria = identidade(SAPATILHA, obrigatoriosDoProduto("MLB23332", MLB23332).exigencias);
  const doPalpite = identidade(SAPATILHA, obrigatoriosDoProduto(null, null).exigencias);
  assert.ok(daCategoria && doPalpite);

  // O palpite cobra DUAS coisas; a categoria cobra UMA. A que sobra é legítima:
  // gênero é obrigatório nas duas, e o nome deste produto não o declara.
  assert.deepEqual(doPalpite.faltando, ["Gênero", "Tipo de calçado"]);
  assert.deepEqual(daCategoria.faltando, ["Gênero"]);
});

test("com o gênero legível, MLB23332 libera e o palpite continua travando", () => {
  // A demonstração limpa do INC-011: mesmo produto, mesmo cadastro. A diferença
  // é só QUAL lista está sendo cobrada.
  // O nome declara o GÃNERO e nÃ£o o tipo â "Sapatilha" no nome resolveria os
  // dois e apagaria a diferenÃ§a que este teste existe para mostrar.
  const comGenero = { ...SAPATILHA, nome: "Modare Feminina 7016.461 Napa Floater Nature" };

  const daCategoria = identidade(comGenero, obrigatoriosDoProduto("MLB23332", MLB23332).exigencias);
  assert.ok(daCategoria);
  assert.deepEqual(daCategoria.faltando, []);
  assert.equal(daCategoria.situacao, "pronta");

  const doPalpite = identidade(comGenero, obrigatoriosDoProduto(null, null).exigencias);
  assert.ok(doPalpite);
  assert.deepEqual(doPalpite.faltando, ["Tipo de calçado"]);
  assert.equal(doPalpite.situacao, "bloqueada", "94 anúncios travados por um campo inexistente");
});

test("categoria desconhecida não vira parede nova: sai igual ao de antes", () => {
  // A prova de que a generalização não muda os 674 de calçado: a lista do
  // palpite é a mesma que o padrão de `avaliarPreparacao` já usava.
  const comPalpite = identidade(SAPATILHA, obrigatoriosDoProduto(null, null).exigencias);
  const semNada = avaliarPreparacao(SAPATILHA, null, {}).etapas.find(
    (e) => e.etapa === "identidade"
  );
  assert.deepEqual(comPalpite, semNada);
});

test("calçado medido e calçado congelado cobram a mesma coisa", () => {
  // Se o retrato divergisse da categoria real, trocar um pelo outro mudaria o
  // que 674 anúncios devem preencher.
  const medido = identidade(SAPATILHA, obrigatoriosDoProduto("MLB273770", MLB273770).exigencias);
  const congelado = identidade(SAPATILHA, OBRIGATORIOS_CALCADO);
  assert.deepEqual(medido?.faltando, congelado?.faltando);
});
