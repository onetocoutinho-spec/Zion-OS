// Qual campo o ML está esperando — e o que esta função se recusa a afirmar.
//
// Medido em 2026-08-01, depois que a leitura passou a pedir `sub_status`:
//
//     150 waiting_for_patch        ← 19% do catálogo
//      60 out_of_stock
//      21 paused_by_seller
//      12 picture_download_pending
//       7 forbidden
//
// `waiting_for_patch` é o ML dizendo "falta alguma coisa, conserte" — e não diz
// o quê. Mas ele publica a lista de exigências da categoria em
// `/categories/{id}/attributes`, com a tag `required`. Cruzar as duas responde
// a pergunta que a lojista tem de verdade: o que preencher.

import test from "node:test";
import assert from "node:assert/strict";
import { exigenciasNaoAtendidas } from "./oQueOMlEstaPedindo.ts";

const CALCADO = [
  { id: "BRAND", nome: "Marca" },
  { id: "GENDER", nome: "Gênero" },
  { id: "FOOTWEAR_TYPE", nome: "Tipo de calçado" },
];
const OBRIGATORIOS = { MLB273770: CALCADO };

const anuncio = (
  mlb: string,
  status: string,
  atributos: string[],
  categoria = "MLB273770"
) => ({ mlb, categoria, status, atributos: atributos.map((id) => ({ id })) });

test("anúncio fora do ar sem o campo exigido é contado, pelo nome do ML", () => {
  const r = exigenciasNaoAtendidas(
    [anuncio("A", "under_review", ["BRAND", "GENDER"])],
    OBRIGATORIOS
  );
  assert.deepEqual(r, [{ id: "FOOTWEAR_TYPE", nome: "Tipo de calçado", anuncios: 1 }]);
});

test("anúncio ATIVO não entra — mandar mexer no que vende é ruído", () => {
  // O ML aceitou o anúncio. Se ele está vendendo com um campo faltando, o
  // campo não é o problema a resolver hoje.
  const r = exigenciasNaoAtendidas([anuncio("A", "active", [])], OBRIGATORIOS);
  assert.deepEqual(r, []);
});

test("ordena do que mais falta para o que menos falta", () => {
  const r = exigenciasNaoAtendidas(
    [
      anuncio("A", "under_review", ["BRAND"]),
      anuncio("B", "paused", ["BRAND"]),
      anuncio("C", "under_review", ["BRAND", "GENDER"]),
    ],
    OBRIGATORIOS
  );
  assert.deepEqual(
    r.map((x) => [x.id, x.anuncios]),
    [
      ["FOOTWEAR_TYPE", 3],
      ["GENDER", 2],
    ]
  );
});

test("categoria SEM exigência conhecida não produz nada — falha aberta", () => {
  // ML fora do ar ou categoria nova: não se afirma exigência que ninguém
  // confirmou. É a mesma regra do DES-001.
  const r = exigenciasNaoAtendidas([anuncio("A", "under_review", [], "MLB999")], OBRIGATORIOS);
  assert.deepEqual(r, []);
});

test("mapa de obrigatórios vazio não acusa nada", () => {
  assert.deepEqual(exigenciasNaoAtendidas([anuncio("A", "under_review", [])], {}), []);
});

test("anúncio completo não aparece, mesmo fora do ar", () => {
  // Fora do ar por OUTRO motivo (out_of_stock, forbidden) com a ficha
  // completa: nada a preencher, e dizer que falta algo seria falso.
  const r = exigenciasNaoAtendidas(
    [anuncio("A", "paused", ["BRAND", "GENDER", "FOOTWEAR_TYPE"])],
    OBRIGATORIOS
  );
  assert.deepEqual(r, []);
});

test("id com espaço em volta AINDA satisfaz a exigência", () => {
  // O que o `trim` faz de verdade. A primeira versão deste teste dizia proteger
  // contra "id em branco" e passava com ou sem o trim — não provava nada. O
  // caso real é o ML (ou um export) devolver " BRAND " e o anúncio ser acusado
  // de faltar um campo que tem.
  const r = exigenciasNaoAtendidas(
    [
      {
        mlb: "A",
        categoria: "MLB273770",
        status: "paused",
        atributos: [{ id: " BRAND " }, { id: "GENDER" }, { id: "FOOTWEAR_TYPE" }],
      },
    ],
    OBRIGATORIOS
  );
  assert.deepEqual(r, [], "acusou falta de BRAND por causa de um espaço");
});

test("categorias diferentes contam contra as exigências DELAS", () => {
  const r = exigenciasNaoAtendidas(
    [
      anuncio("A", "under_review", [], "MLB273770"),
      anuncio("B", "under_review", [], "MLB23332"),
    ],
    { MLB273770: CALCADO, MLB23332: [{ id: "BRAND", nome: "Marca" }] }
  );
  const marca = r.find((x) => x.id === "BRAND");
  const tipo = r.find((x) => x.id === "FOOTWEAR_TYPE");
  assert.equal(marca?.anuncios, 2, "BRAND é exigido nas duas");
  assert.equal(tipo?.anuncios, 1, "FOOTWEAR_TYPE só é exigido numa");
});

test("lista vazia não produz nada", () => {
  assert.deepEqual(exigenciasNaoAtendidas([], OBRIGATORIOS), []);
});
