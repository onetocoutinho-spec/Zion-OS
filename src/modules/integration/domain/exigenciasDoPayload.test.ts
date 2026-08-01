// DES-001 D4 — a exigência conferida antes de mandar.
//
// O risco desta função é o mesmo que o DES-001 arrancou do A10: uma exigência
// FALSA trava a publicação para sempre. Então o teste que mais importa aqui não
// é "acusa o que falta" — é "NÃO acusa o que está lá".

import test from "node:test";
import assert from "node:assert/strict";
import { obrigatoriosAusentes, explicarAusentes } from "./exigenciasDoPayload.ts";

const SEIS = [
  { id: "BRAND", nome: "Marca" },
  { id: "MODEL", nome: "Modelo" },
  { id: "GENDER", nome: "Gênero" },
  { id: "COLOR", nome: "Cor" },
  { id: "SIZE", nome: "Tamanho" },
  { id: "FOOTWEAR_TYPE", nome: "Tipo de calçado" },
];

/** Um payload como `montarItemML` monta: ficha em `attributes`, grade em `variations`. */
const payloadCompleto = {
  category_id: "MLB273770",
  attributes: [
    { id: "BRAND", value_name: "Modare" },
    { id: "MODEL", value_name: "7208.101" },
    { id: "GENDER", value_name: "Feminino" },
    { id: "FOOTWEAR_TYPE", value_name: "Papete" },
    { id: "SELLER_SKU", value_name: "00956135" },
  ],
  variations: [
    {
      attribute_combinations: [
        { id: "SIZE", value_name: "35" },
        { id: "COLOR", value_name: "Nude" },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// O TESTE QUE MAIS IMPORTA
// ---------------------------------------------------------------------------

test("NÃO acusa SIZE e COLOR — eles moram nas variações, não em attributes", () => {
  // Olhar só `attributes` acusaria os dois em TODO anúncio com grade — e a
  // grade é justamente o que o cadastro sempre preenche. Seria uma trava
  // permanente sobre um dado que está lá.
  assert.deepEqual(obrigatoriosAusentes(payloadCompleto, SEIS), []);
});

test("sem exigidos, NÃO bloqueia nada", () => {
  // Se não deu para perguntar ao ML o que ele exige, afirmar uma exigência
  // seria o defeito. O ML continua sendo a última palavra.
  assert.deepEqual(obrigatoriosAusentes({}, []), []);
  assert.deepEqual(obrigatoriosAusentes({ attributes: [] }, []), []);
});

// ---------------------------------------------------------------------------
// E O QUE ELA DEVE ACUSAR
// ---------------------------------------------------------------------------

test("acusa o que realmente falta, e só isso", () => {
  const semGenero = {
    ...payloadCompleto,
    attributes: payloadCompleto.attributes.filter((a) => a.id !== "GENDER"),
  };
  const faltando = obrigatoriosAusentes(semGenero, SEIS);
  assert.deepEqual(faltando, [{ id: "GENDER", nome: "Gênero" }]);
});

test("payload sem grade nenhuma acusa SIZE e COLOR — aí eles faltam mesmo", () => {
  const semVariacoes = { ...payloadCompleto, variations: [] };
  const ids = obrigatoriosAusentes(semVariacoes, SEIS).map((a) => a.id);
  assert.deepEqual(ids, ["COLOR", "SIZE"]);
});

test("atributo mandado só por NOME conta como ausente — e está certo", () => {
  // `montarItemML` manda `{ name, value_name }` quando não conhece o id. O ML
  // pode até casar pelo nome, mas não é garantido — e dizer "está lá" sobre
  // algo que talvez não chegue seria afirmar o que não se sabe.
  const porNome = {
    attributes: [{ name: "Marca", value_name: "Modare" }],
    variations: [],
  };
  const ids = obrigatoriosAusentes(porNome, [{ id: "BRAND", nome: "Marca" }]).map((a) => a.id);
  assert.deepEqual(ids, ["BRAND"]);
});

test("lê também `variations[].attributes`, não só as combinações", () => {
  const naVariacao = {
    attributes: [],
    variations: [{ attributes: [{ id: "GTIN", value_name: "789" }] }],
  };
  assert.deepEqual(obrigatoriosAusentes(naVariacao, [{ id: "GTIN", nome: "GTIN" }]), []);
});

test("payload vazio com exigidos acusa todos — sem quebrar", () => {
  assert.equal(obrigatoriosAusentes({}, SEIS).length, 6);
});

// ---------------------------------------------------------------------------
// A FRASE
// ---------------------------------------------------------------------------

test("a mensagem NOMEIA os atributos — em português", () => {
  // "Faltam atributos obrigatórios" sem dizer quais é a mesma inutilidade de
  // "3 conflitos" sem dizer onde.
  const frase = explicarAusentes([
    { id: "GENDER", nome: "Gênero" },
    { id: "FOOTWEAR_TYPE", nome: "Tipo de calçado" },
  ]);
  assert.match(frase, /Gênero, Tipo de calçado/);
  assert.match(frase, /Complete a ficha técnica/);
  assert.ok(!/attribute|required|missing/i.test(frase), "vazou termo em inglês para a lojista");
});

test("singular e plural concordam — o texto é para gente", () => {
  const um = explicarAusentes([{ id: "GENDER", nome: "Gênero" }]);
  assert.match(um, /este atributo/);
  assert.match(um, /ele não está/);
  const dois = explicarAusentes([
    { id: "GENDER", nome: "Gênero" },
    { id: "BRAND", nome: "Marca" },
  ]);
  assert.match(dois, /estes atributos/);
  assert.match(dois, /eles não estão/);
});
