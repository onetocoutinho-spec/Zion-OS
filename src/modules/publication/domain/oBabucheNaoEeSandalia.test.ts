// O nome diz o que a coisa É; as palavras-chave dizem com o que ela CONCORRE.
//
// ===========================================================================
// ACHADO POR QUEM OLHOU A TELA — 28/08/2026
// ===========================================================================
//
// A lojista abriu `/cliente/atributos` e perguntou: "por que tem babuche em
// sandálias e babuche em chinelos?". Estava mesmo: 30 babuches divididos 18/12
// entre os dois grupos.
//
// A causa: "babuche" não existe no vocabulário. A categoria MLB273770 aceita
// quatro valores — Sandália, Chinelo, Tamanco, Mule — e babuche não é nenhum.
// Então o tipo vinha de outra palavra qualquer da lista de busca:
//
//     "babuche infantil feminina, calçado Yvate kids, babuche em EVA,
//      sandália infantil..."          <- era este "sandália" que decidia
//
// Quem a loja descreveu com "sandália" virou Sandália; quem descreveu com
// "chinelo" virou Chinelo. Não era o produto decidindo — era qual sinônimo de
// SEO ela usou para ser encontrada na busca.
//
// Medido na planilha real: dos 342 babuches, 330 não trazem tipo aceito nenhum
// no nome, e 12 trazem "sandália" no próprio nome.
//
// Nenhum teste meu pegaria isto: os dois grupos estavam certos por dentro, e o
// defeito só aparece quando alguém vê os dois lado a lado.
//
// Rodar: npx tsx --test src/modules/publication/domain/oBabucheNaoEeSandalia.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { atributosParaOCadastro } from "./composicaoConteudo.ts";

/** As palavras-chave reais de um babuche Yvate, da exportação de 19/08. */
const KW_BABUCHE =
  "babuche infantil feminina, calçado Yvate kids, babuche em EVA, sandália infantil, chinelo fechado";

const tipoDe = (r: { nomeAtributo: string; valorAtributo: string }[]) =>
  r.find((a) => a.nomeAtributo === "Tipo de calçado")?.valorAtributo;
const generoDe = (r: { nomeAtributo: string; valorAtributo: string }[]) =>
  r.find((a) => a.nomeAtributo === "Gênero")?.valorAtributo;

test("BABUCHE NÃO VIRA SANDÁLIA nem chinelo — vira pergunta", () => {
  const r = atributosParaOCadastro({
    nome: "Babuche Yvate Kids Liso",
    palavrasChave: KW_BABUCHE,
  });
  assert.equal(tipoDe(r), undefined, "o tipo saiu de uma palavra de SEO");
});

test("o mesmo babuche descrito com 'chinelo' também não vira chinelo", () => {
  // O outro lado da divisão 18/12: dois produtos iguais só se separavam pela
  // palavra que a loja escolheu para a busca.
  const r = atributosParaOCadastro({
    nome: "Babuche Boaonda 1944.208 Brave",
    palavrasChave: "babuche, chinelo infantil, chinelo fechado boaonda",
  });
  assert.equal(tipoDe(r), undefined);
});

test("O GÊNERO CRUZA OS DOIS TEXTOS, e não escolhe um", () => {
  // Medido em 28/08: ler o nome primeiro e cair nas palavras só se ele calasse
  // jogava fora a resposta mais específica. "Sandália Molekinha Infantil" dá
  // "Sem gênero" sozinho; com "sandália infantil feminina" ao lado, dá Meninas.
  const r = atributosParaOCadastro({
    nome: "Sandália Molekinha Infantil 2357",
    palavrasChave: "sandália infantil feminina, molekinha, brilho",
  });
  assert.equal(generoDe(r), "Meninas", "o nome sozinho apagou a metade específica");
});

test("mas o gênero SAI das palavras-chave — é para quem é, não o que é", () => {
  // A distinção inteira: "para quem" a loja diz na descrição, e diz certo;
  // "o que é" ela diz no nome. Os 30 babuches continuam propondo gênero.
  const r = atributosParaOCadastro({
    nome: "Babuche Yvate Kids Liso",
    palavrasChave: KW_BABUCHE,
  });
  assert.equal(generoDe(r), "Meninas", "o gênero se perdeu junto com o tipo");
});

test("quando o NOME diz o tipo, a loja já respondeu", () => {
  // São os 12 dos 342: o nome traz "sandália", e aí não há dedução nenhuma.
  const r = atributosParaOCadastro({
    nome: "Sandália Babuche Grendene Kids 23197",
    palavrasChave: KW_BABUCHE,
  });
  assert.equal(tipoDe(r), "Sandália");
});

test("o tipo NUNCA sai das palavras-chave, mesmo sem conflito", () => {
  // Sem esta linha, um produto cujo nome cala e cujas palavras-chave dizem
  // "chinelo" voltaria a ser classificado por SEO — e o defeito volta pela
  // porta de trás, num caso que ninguém está olhando.
  const r = atributosParaOCadastro({
    nome: "Calçado Yvate 4020 Confort",
    palavrasChave: "chinelo, chinelo confortável, chinelo yvate",
  });
  assert.equal(tipoDe(r), undefined);
});

test("nome e palavras-chave vazios não afirmam nada", () => {
  assert.deepEqual(atributosParaOCadastro({}), []);
  assert.deepEqual(atributosParaOCadastro({ nome: "  ", palavrasChave: "  " }), []);
});

// ---------------------------------------------------------------------------
// A OUTRA METADE: a tela tem que MOSTRAR a contradição.
// ---------------------------------------------------------------------------
//
// Consertar a regra impede a proposta errada de nascer. Não impede a que já
// nasceu — e foi uma dessas que pôs "Tamanco Azaleia 19112" dentro de um lote
// de 324 "Chinelo", confirmado num toque porque a tela mostrava três itens.

import { oNomeContradiz } from "./composicaoConteudo.ts";

const TIPO = "Tipo de calçado";
const GENERO = "Gênero";

test("o nome que diz OUTRO tipo é contradição — e a tela marca", () => {
  // Os quatro casos reais que entraram no lote de 324.
  assert.equal(oNomeContradiz("Tamanco Azaleia 19112 Taina", TIPO, "Chinelo"), true);
  assert.equal(oNomeContradiz("Sandália Cartago 12489 Atlanta", TIPO, "Chinelo"), true);
  assert.equal(oNomeContradiz("Tamanco Modare 7125.244 Microperfuros", TIPO, "Chinelo"), true);
  assert.equal(oNomeContradiz("Sandalia Papete Baby Menina Grendene", TIPO, "Chinelo"), true);
});

test("A COMPARAÇÃO É DO MESMO ATRIBUTO — e não era", () => {
  // A primeira versão comparava sempre o TIPO do nome contra o valor proposto,
  // fosse ele qual fosse. Num grupo "Gênero Meninas", o nome "Sandália
  // Molekinha" produzia tipo "Sandália", que difere de "Meninas" — e a tela
  // marcava. Medido em staging: 481 marcas em 1.061 propostas, TODAS falsas, e
  // zero nos grupos de tipo, onde a marca faria sentido.
  //
  // Marca que aparece em metade dos itens deixa de ser marca.
  assert.equal(oNomeContradiz("Sandália Molekinha Infantil 2357", GENERO, "Meninas"), false);
  assert.equal(oNomeContradiz("Chinelo Rider Infantil", GENERO, "Meninos"), false);
});

test("REFINAR NÃO É CONTRADIZER — 'Sem gênero' convive com Meninas", () => {
  // O nome diz apenas "Infantil" e produz "Sem gênero"; a proposta cruza nome e
  // palavras-chave e produz "Meninas". Um refina o outro.
  assert.equal(oNomeContradiz("Sandália Molekinha Infantil", GENERO, "Meninas"), false);
  assert.equal(oNomeContradiz("Chinelo Infantil Menino", GENERO, "Sem gênero"), false);
});

test("mas gênero de lado OPOSTO é contradição de verdade", () => {
  // Os 18 que sobraram marcados em staging são deste tipo: o nome diz o lado
  // adulto e a proposta diz o infantil. "Sandália Molekinha 2312.260 Turim Fem"
  // contra "Meninas" — vale ela olhar.
  assert.equal(oNomeContradiz("Sandália Molekinha Turim Fem", GENERO, "Meninas"), true);
  assert.equal(oNomeContradiz("Sapatênis Molekinho Neo Masculino", GENERO, "Meninos"), true);
  assert.equal(oNomeContradiz("Chinelo Feminino Slim", GENERO, "Masculino"), true);
});

test("nome que CONCORDA não é contradição", () => {
  assert.equal(oNomeContradiz("Chinelo Havaianas Top Brasil", TIPO, "Chinelo"), false);
  assert.equal(oNomeContradiz("Sandália Molekinha 2357.108", TIPO, "Sandália"), false);
});

test("nome que não diz tipo nenhum NÃO é contradição — só não confirma", () => {
  // O babuche e a papete: o nome não nomeia um tipo aceito, então não há o que
  // contradizer. Marcá-los seria gritar em 330 produtos e ensinar a ignorar a
  // marca justamente onde ela precisa ser vista.
  assert.equal(oNomeContradiz("Babuche Yvate Kids Liso", TIPO, "Chinelo"), false);
  assert.equal(oNomeContradiz("Papete Moleca 5469.135 Santorini", TIPO, "Chinelo"), false);
  assert.equal(oNomeContradiz("Calçado Yvate 4020 Confort", TIPO, "Sandália"), false);
});

test("atributo que a tela não conhece não marca nada", () => {
  assert.equal(oNomeContradiz("Chinelo Havaianas", "Material", "EVA"), false);
});

test("acento e caixa não inventam contradição", () => {
  assert.equal(oNomeContradiz("SANDALIA CARTAGO 12489", TIPO, "Sandália"), false);
  assert.equal(oNomeContradiz("sandália cartago", TIPO, "Sandália"), false);
});
