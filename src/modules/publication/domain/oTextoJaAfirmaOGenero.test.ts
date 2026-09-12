// O que o título publica, a ficha pode dizer — não é palpite, é coerência.
//
// ===========================================================================
// A CONTRADIÇÃO, MEDIDA EM 28/08/2026
// ===========================================================================
//
// Dos 12 anúncios que o bundle User Products recusava por gênero ausente,
// CINCO traziam a palavra no título que ia subir:
//
//     Chinelo Slide Infantil Molekinha Nuvem 2338.110 EVA
//     Chinelo Rider Infantil Masculino 12673 Core Up
//     Sandália Papete Infantil Zaxynina 19060 Moderninha
//     Chinelo Ipanema infantil Disney Joy 27323
//     Chinelo Olympikus 921 unissex conforto
//
// O anúncio subiria com "Infantil" na linha mais visível que existe, e o
// sistema o recusava dizendo não saber o gênero.
//
// ===========================================================================
// A LINHA QUE ESTE TESTE DEFENDE
// ===========================================================================
//
// `doCadastroParaOPayload` recusa `origem: "nome"` e CONTINUA CERTO: aquela
// leitura é do nome do CADASTRO, uma string que ninguém publica, e afirmar a
// partir dela é pôr na boca da lojista o que ela não disse.
//
// Aqui a string é o TÍTULO QUE VAI AO AR. Preencher o atributo com o que ele já
// declara não acrescenta afirmação — acrescenta o mesmo dito, no campo que o
// marketplace lê.
//
// O corte de 60 caracteres é parte da regra, não detalhe: palavra depois do
// corte não é publicada, e sobre o que não sobe não há coerência a invocar.
//
// Rodar: npx tsx --test src/modules/publication/domain/oTextoJaAfirmaOGenero.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import {
  oQueOTextoAfirma,
  tituloPublicado,
  montarBundleUserProducts,
  fichaDoCadastro,
  LIMITE_DO_TITULO,
  GENERO_ID,
  FOOTWEAR_TYPE_ID,
} from "./composicaoConteudo.ts";
import type { AnuncioGerado } from "../../../lib/agentes/esteira.ts";

function anuncio(titulo: string, ficha: { atributo: string; valor: string }[] = []): AnuncioGerado {
  return {
    notaDiagnostico: 90,
    tituloOtimizado: titulo,
    palavrasChavePrincipais: [],
    palavrasChaveSecundarias: [],
    descricaoCompleta: "Descrição.",
    descricaoCurta: "Curta.",
    fichaTecnica: [{ atributo: "Marca", valor: "Ipanema" }, ...ficha],
    tabelaMedidas: "",
    comoMedir: "",
    forma: "normal",
    imagensSugeridas: [],
    faq: [],
    sugestoes: [],
    pendencias: [],
    vereditoA10: "aprovado",
    motivoVeredito: "",
    variacoes: [
      { cor: "Preto", tamanho: "37/38", sku: "A1", ean: "789", estoque: 3, preco: 39.9 },
    ],
  } as unknown as AnuncioGerado;
}

const FOTOS = { pictures: ["https://exemplo/1.jpg"] };

test("os cinco títulos reais que estavam sendo recusados", () => {
  const reais = [
    "Chinelo Slide Infantil Molekinha Nuvem 2338.110 EVA",
    "Chinelo Rider Infantil Masculino 12673 Core Up",
    "Sandália Papete Infantil Zaxynina 19060 Moderninha",
    "Chinelo Ipanema infantil Disney Joy 27323",
    "Chinelo Olympikus 921 unissex conforto",
  ];
  for (const titulo of reais) {
    const afirma = oQueOTextoAfirma(titulo);
    assert.ok(
      afirma.some((a) => a.id === "GENDER"),
      `"${titulo}" não teve o gênero lido`
    );
  }
});

test("DUAS PALAVRAS NA MESMA FRASE: vence a mais específica, não a primeira", () => {
  // A revisão de 28/08 pegou isto no próprio conserto: `generoParaId` era uma
  // cascata de `if`s feita para um CAMPO de valor único, e recebendo o título
  // inteiro vencia a primeira da lista. "Chinelo Rider Infantil Masculino" —
  // um dos cinco títulos que justificaram a mudança — publicava sapato de
  // MENINO como masculino ADULTO.
  const g = (t: string) => oQueOTextoAfirma(t).find((a) => a.id === "GENDER");
  assert.equal(g("Chinelo Rider Infantil Masculino 12673 Core Up")?.valorId, GENERO_ID.meninos);
  assert.equal(g("Sandalia Molekinha Infantil Feminina 2357")?.valorId, GENERO_ID.meninas);
  assert.equal(g("Chinelo Infantil Menino Rider")?.valorId, GENERO_ID.meninos);
  // Sem lado, o marcador infantil sozinho continua "sem gênero infantil".
  assert.equal(g("Chinelo Slide Infantil Molekinha")?.valorId, GENERO_ID.sem_genero_infantil);
  // E sem marcador infantil, o adulto continua adulto.
  assert.equal(g("Chinelo Slim Feminino Conforto")?.valorId, GENERO_ID.feminino);
});

test("A TERMINAÇÃO FEMININA DO ADJETIVO conta — era o acaso que escondia o defeito", () => {
  // `/feminino/` não casava "Feminina", então "Infantil Feminina" caía no
  // `/infantil/` seguinte e dava "Sem gênero". Parecia funcionar por sorte.
  const g = (t: string) => oQueOTextoAfirma(t).find((a) => a.id === "GENDER");
  assert.equal(g("Sandália Feminina Modare")?.valorId, GENERO_ID.feminino);
  assert.equal(g("Sandália Masculina Rider")?.valorId, GENERO_ID.masculino);
});

test("OS DOIS LADOS JUNTOS não são uma terceira categoria — devolvem null", () => {
  // "Chinelo Feminino e Masculino" é uma frase que não responde. Null vira
  // pergunta, que é a resposta certa para o que não se sabe.
  assert.deepEqual(
    oQueOTextoAfirma("Chinelo Feminino e Masculino Unissex").filter((a) => a.id === "GENDER"),
    []
  );
});

test("título sem a palavra não afirma nada — continua virando pergunta", () => {
  // Os outros sete dos doze. O silêncio tem que continuar sendo silêncio.
  for (const titulo of [
    "Chinelo Havaianas Top Brasil Vibes Original Conforto",
    "Chinelo Rider 11592 Slide Street",
    "Chinelo Cartago Alabama 1 11859",
  ]) {
    assert.deepEqual(
      oQueOTextoAfirma(titulo).filter((a) => a.id === "GENDER"),
      [],
      `"${titulo}" inventou um gênero`
    );
  }
});

test("O CORTE DE 60 É A REGRA: palavra que não sobe não afirma", () => {
  const enchimento = "Chinelo Conforto Leve Macio Antiderrapante Original Bonito";
  const depoisDoCorte = `${enchimento} Feminino`;
  assert.ok(depoisDoCorte.length > LIMITE_DO_TITULO);
  assert.ok(!tituloPublicado(anuncio(depoisDoCorte)).includes("Feminino"));
  assert.deepEqual(
    oQueOTextoAfirma(tituloPublicado(anuncio(depoisDoCorte))).filter((a) => a.id === "GENDER"),
    [],
    "leu uma palavra que o Mercado Livre não vai publicar"
  );
});

test("a FICHA continua mandando sobre o título", () => {
  // O título diz Infantil; a ficha diz Masculino. Vale a ficha — o título entra
  // por último e só quando os outros calam.
  const a = anuncio("Chinelo Slide Infantil Molekinha", [
    { atributo: "Gênero", valor: "Masculino" },
  ]);
  const r = montarBundleUserProducts(a, FOTOS);
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
  assert.equal(r.ok && r.bundle.generoNome, "Masculino");
});

test("o CADASTRO também manda sobre o título", () => {
  const a = anuncio("Chinelo Slide Infantil Molekinha");
  const doCadastro = fichaDoCadastro([{ nomeAtributo: "Gênero", valorAtributo: "Feminino" }]);
  const r = montarBundleUserProducts(a, { ...FOTOS, doCadastro });
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
  assert.equal(r.ok && r.bundle.generoId, GENERO_ID.feminino);
});

test("sem ficha e sem cadastro, o título destrava o bundle", () => {
  const r = montarBundleUserProducts(anuncio("Chinelo Slide Infantil Molekinha"), FOTOS);
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
  assert.equal(r.ok && r.bundle.generoId, GENERO_ID.sem_genero_infantil);
});

test("e o tipo de calçado sai do título pelo mesmo caminho", () => {
  const r = montarBundleUserProducts(anuncio("Chinelo Slide Infantil Molekinha"), FOTOS);
  assert.equal(r.ok && r.bundle.footwearTypeId, FOOTWEAR_TYPE_ID.chinelo);
});

test("nada em lugar nenhum: recusa, e o motivo nomeia as três fontes", () => {
  const r = montarBundleUserProducts(anuncio("Calçado Bonito 123"), FOTOS);
  assert.equal(r.ok, false);
  const motivo = r.ok === false ? r.motivo : "";
  assert.match(motivo, /ficha/i);
  assert.match(motivo, /cadastro/i);
  assert.match(motivo, /t[íi]tulo/i);
});

test("as duas formas do valor saem juntas — id para o bundle, nome para o clássico", () => {
  const [g] = oQueOTextoAfirma("Chinelo Feminino Bonito").filter((a) => a.id === "GENDER");
  assert.equal(g.valorId, GENERO_ID.feminino);
  assert.equal(g.valorNome, "Feminino");
});
