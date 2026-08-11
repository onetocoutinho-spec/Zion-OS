// O que a lojista PREENCHEU chega ao resolvedor — antes do palpite.
//
// ===========================================================================
// O DEFEITO — MEDIDO EM PRODUÇÃO, 11/08/2026
// ===========================================================================
//
// `dadosDoProduto` passava só nome, marca, modelo, cores e tamanhos. Os
// atributos do cadastro — `produto_atributos`, com "Gênero" preenchido em 73
// de 80 produtos — nunca chegavam ao resolvedor.
//
// `GENDER` caía direto no palpite pelo NOME. Quando o nome não traz a palavra
// ("Sapatilha Modare 7016.461 Napa Floater Nature"), o software declarava o
// gênero AUSENTE e travava a publicação — de um produto cujo cadastro dizia
// "Feminino".
//
// São 26 produtos em que SÓ o cadastro sabe. Em todos eles o software acusava
// a lojista de não ter preenchido exatamente o que ela preencheu.
//
// A ordem em `resolver` já estava certa — cadastro, marketplace, palpite. Só
// faltava o cadastro chegar.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolverObrigatorios } from "./atributosDoMarketplace.ts";

const EXIGE_GENERO = [{ id: "GENDER", nome: "Gênero" }];

const SEM_PISTA = {
  nome: "Sapatilha Modare 7016.461 Napa Floater Nature",
  marca: "Modare",
  modelo: "7016.461",
  cores: ["Nature"],
  tamanhos: ["35", "36"],
};

test("O CASO REAL: nome sem pista + cadastro preenchido => vem do CADASTRO", () => {
  const r = resolverObrigatorios(
    { ...SEM_PISTA, atributos: new Map([["Gênero", "Feminino"]]) },
    EXIGE_GENERO
  );
  const g = r.find((a) => a.id === "GENDER");
  assert.equal(g?.valor, "Feminino", "o gênero do cadastro continua sendo ignorado");
  assert.equal(g?.origem, "cadastro", "veio de outro lugar que não o cadastro dela");
});

test("sem cadastro E sem pista no nome, continua AUSENTE — não inventa", () => {
  // A recusa honesta segue existindo: sete produtos desta base realmente não
  // têm o atributo, e para eles a resposta certa é pedir, não adivinhar.
  const r = resolverObrigatorios(SEM_PISTA, EXIGE_GENERO);
  assert.equal(r.find((a) => a.id === "GENDER")?.origem, "ausente");
});

test("o CADASTRO tem precedência sobre o palpite pelo nome", () => {
  // "Babuche Moleca Pvc 5832.100 Conforto Feminino" — o nome diz Feminino.
  // Se o cadastro disser outra coisa, quem manda é o cadastro: ela sabe do
  // produto dela mais que um regex sobre o título.
  const r = resolverObrigatorios(
    {
      ...SEM_PISTA,
      nome: "Babuche Moleca Pvc 5832.100 Conforto Feminino",
      atributos: new Map([["Gênero", "Unissex"]]),
    },
    EXIGE_GENERO
  );
  const g = r.find((a) => a.id === "GENDER");
  assert.equal(g?.valor, "Unissex");
  assert.equal(g?.origem, "cadastro");
});

test("atributo em BRANCO no cadastro não conta como preenchido", () => {
  const r = resolverObrigatorios(
    { ...SEM_PISTA, atributos: new Map([["Gênero", "   "]]) },
    EXIGE_GENERO
  );
  assert.equal(r.find((a) => a.id === "GENDER")?.origem, "ausente");
});

test("quem NÃO passa atributos continua funcionando como antes", () => {
  // O campo é opcional de propósito: torná-lo obrigatório quebraria todo
  // chamador de uma vez, e o conserto ficaria parado esperando o refactor.
  const r = resolverObrigatorios(
    { ...SEM_PISTA, nome: "Sandália Feminina Slide Modare" },
    EXIGE_GENERO
  );
  assert.equal(r.find((a) => a.id === "GENDER")?.origem, "nome");
});

// ---------------------------------------------------------------------------
// O ATALHO DAS VARIANTES VAZIAS, e a premissa que o sustenta
// ---------------------------------------------------------------------------
//
// `propor_publicacao` traduz `ProdutoParaPreparar` para `ProdutoParaAnalise` e
// passa `variantes: []`. Isso só é honesto enquanto NENHUMA pendência de
// variante bloquear publicar.
//
// Se um dia `peso_variante` passar a bloquear, o atalho silenciaria a trava —
// e a lojista publicaria o que não devia. Esta guarda quebra antes.

test("SÓ preço e foto bloqueiam publicar — as duas são de produto", () => {
  const fonte = readFileSync(
    new URL("../../catalog/domain/pendenciasDoCatalogo.ts", import.meta.url),
    "utf8"
  );
  const bloco = fonte.slice(fonte.indexOf("const BLOQUEIOS"), fonte.indexOf("const IMPEDE"));

  const bloqueiam = [...bloco.matchAll(/^\s*(\w+):\s*\[([^\]]*)\]/gm)]
    .filter(([, , caps]) => caps.includes('"publicar"'))
    .map(([, tipo]) => tipo)
    .sort();

  assert.deepEqual(
    bloqueiam,
    ["foto", "preco"],
    "mudou quem bloqueia publicar — o atalho de `variantes: []` em `propor_publicacao` deixou de ser honesto"
  );
});
