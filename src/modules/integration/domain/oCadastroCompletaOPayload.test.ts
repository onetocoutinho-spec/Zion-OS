// O cadastro preenche o obrigatório que o modelo esqueceu — e só isso.
//
// ===========================================================================
// O QUE ESTE TESTE GUARDA
// ===========================================================================
//
// `doCadastroParaOPayload` existe porque o ensaio de 28/08/2026 mediu, nos 793
// publicáveis da base real, que 500 seriam recusados pelo Mercado Livre por
// atributo obrigatório — e que em 497 a resposta já estava no banco, escrita
// pela lojista.
//
// O risco da função é o SIMÉTRICO do risco de `obrigatoriosAusentes`: aquela
// não pode afirmar uma exigência que ninguém confirmou; esta não pode afirmar
// um VALOR que a lojista não deu. Publicar um palpite sob a conta dela é
// colocar na boca dela uma resposta que ela não disse.
//
// Por isso o teste que mais importa aqui não é "preenche o que falta" — é
// "NÃO preenche com dedução".
//
// Rodar: npx tsx --test src/modules/integration/domain/oCadastroCompletaOPayload.test.ts

import test from "node:test";
import assert from "node:assert/strict";
import { doCadastroParaOPayload, obrigatoriosAusentes } from "./exigenciasDoPayload.ts";

const GENERO = { id: "GENDER", nome: "Gênero" };
const TIPO = { id: "FOOTWEAR_TYPE", nome: "Tipo de calçado" };

test("o que a lojista respondeu entra", () => {
  const r = doCadastroParaOPayload(
    [GENERO, TIPO],
    [
      { id: "GENDER", valor: "Feminino", origem: "cadastro" },
      { id: "FOOTWEAR_TYPE", valor: "Chinelo", origem: "cadastro" },
    ]
  );
  assert.deepEqual(r, [
    { id: "GENDER", value_name: "Feminino" },
    { id: "FOOTWEAR_TYPE", value_name: "Chinelo" },
  ]);
});

test("DEDUÇÃO PELO NOME NÃO ENTRA — é o ponto da função", () => {
  // "Chinelo Feminino Slide" no título deduz GENDER=Feminino, e isso serve para
  // sugerir num briefing. Publicado, vira uma afirmação da lojista que ela não
  // fez — e o anúncio fica no ar sob a conta dela.
  const r = doCadastroParaOPayload([GENERO], [{ id: "GENDER", valor: "Feminino", origem: "nome" }]);
  assert.deepEqual(r, [], "palpite pelo nome foi publicado");
});

test("ausente continua ausente — null vira pergunta", () => {
  const r = doCadastroParaOPayload([GENERO], [{ id: "GENDER", valor: null, origem: "ausente" }]);
  assert.deepEqual(r, []);
});

test("valor em branco não conta como resposta", () => {
  const r = doCadastroParaOPayload([GENERO], [{ id: "GENDER", valor: "   ", origem: "cadastro" }]);
  assert.deepEqual(r, []);
});

test("o que o marketplace já sabe entra — é dado, não palpite", () => {
  const r = doCadastroParaOPayload([GENERO], [{ id: "GENDER", valor: "Feminino", origem: "marketplace" }]);
  assert.deepEqual(r, [{ id: "GENDER", value_name: "Feminino" }]);
});

test("só o que FALTA — o que já está no payload não é reescrito", () => {
  // A lista de ausentes é o filtro: um resolvido para um atributo que o payload
  // já tem nunca aparece aqui, e sobrescrever o que o modelo escreveu seria
  // trocar a resposta de um por outro sem ninguém pedir.
  const r = doCadastroParaOPayload(
    [GENERO],
    [
      { id: "GENDER", valor: "Feminino", origem: "cadastro" },
      { id: "BRAND", valor: "Outra Marca", origem: "cadastro" },
    ]
  );
  assert.deepEqual(r, [{ id: "GENDER", value_name: "Feminino" }]);
});

test("nada a preencher devolve nada", () => {
  assert.deepEqual(doCadastroParaOPayload([], [{ id: "GENDER", valor: "F", origem: "cadastro" }]), []);
  assert.deepEqual(doCadastroParaOPayload([GENERO], []), []);
});

test("acrescentado ao payload, o ausente deixa de ser ausente", () => {
  // A ponta a ponta da regra, com as duas funções que a publicação usa em
  // sequência: é isto que transforma uma recusa em uma publicação.
  const payload: Record<string, unknown> = {
    category_id: "MLB273770",
    attributes: [{ id: "BRAND", value_name: "Havaianas" }],
    variations: [{ attribute_combinations: [{ id: "SIZE" }, { id: "COLOR" }] }],
  };
  const exigidos = [{ id: "BRAND", nome: "Marca" }, GENERO, { id: "SIZE", nome: "Tamanho" }];

  const antes = obrigatoriosAusentes(payload, exigidos);
  assert.deepEqual(antes.map((a) => a.id), ["GENDER"]);

  payload.attributes = [
    ...(payload.attributes as unknown[]),
    ...doCadastroParaOPayload(antes, [{ id: "GENDER", valor: "Feminino", origem: "cadastro" }]),
  ];
  assert.deepEqual(obrigatoriosAusentes(payload, exigidos), []);
});
