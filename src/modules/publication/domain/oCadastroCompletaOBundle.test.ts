// A porta do User Products também lê o cadastro — e a ficha continua mandando.
//
// ===========================================================================
// A MEDIÇÃO QUE TROUXE ISTO
// ===========================================================================
//
// Em 28/08/2026 o ensaio do passo 7 mediu o caminho CLÁSSICO e disse que 788
// dos 793 publicáveis passariam. O número estava certo para a função errada:
// `publicarNoMercadoLivre` bifurca antes daquela conferência, e MLB273770 —
// calçado — vai por User Products.
//
//     User Products (MLB273770) ... 674   85% dos publicáveis
//     clássico (as outras cinco) .. 119
//
// Medido então no portão de verdade destes 674, `montarBundleUserProducts`:
//
//     bundle monta ...... 258
//     bundle recusa ..... 416
//         408  gênero ausente ou não reconhecido na ficha técnica
//           8  nenhuma variação com tamanho publicável + medida da marca
//
// O MESMO defeito do caminho clássico, pela outra porta: a ficha técnica é
// escrita pelo modelo e traz "Gênero" em 159 de 400, enquanto a resposta está
// em `produto_atributos`, preenchida pela lojista.
//
// ===========================================================================
// O QUE ESTE TESTE GUARDA
// ===========================================================================
//
// Duas coisas, e a segunda é a que dói se quebrar:
//
//   1. o cadastro preenche o que a ficha não trouxe;
//   2. a FICHA CONTINUA MANDANDO quando ela respondeu.
//
// O anúncio é o trabalho do modelo sobre este produto; o cadastro é a resposta
// de antes. Deixar o cadastro sobrescrever a ficha trocaria a resposta nova
// pela velha sem ninguém pedir — e o sintoma seria um anúncio publicado com um
// atributo que ninguém vê na tela do anúncio.
//
// Rodar: npx tsx --test src/modules/publication/domain/oCadastroCompletaOBundle.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import { montarBundleUserProducts, fichaDoCadastro } from "./composicaoConteudo.ts";
import type { AnuncioGerado } from "../../../lib/agentes/esteira.ts";

function anuncio(ficha: { atributo: string; valor: string }[]): AnuncioGerado {
  return {
    notaDiagnostico: 90,
    tituloOtimizado: "Chinelo Slide Ipanema Anatômico",
    palavrasChavePrincipais: [],
    palavrasChaveSecundarias: [],
    descricaoCompleta: "Descrição completa do chinelo.",
    descricaoCurta: "Chinelo.",
    fichaTecnica: ficha,
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
      { cor: "Preto", tamanho: "39/40", sku: "A2", ean: "790", estoque: 2, preco: 39.9 },
    ],
  } as unknown as AnuncioGerado;
}

const SO_MARCA = [{ atributo: "Marca", valor: "Ipanema" }];
const FOTOS = { pictures: ["https://exemplo/1.jpg"] };

test("sem gênero em lugar nenhum, recusa — a pergunta tem que chegar nela", () => {
  const r = montarBundleUserProducts(anuncio(SO_MARCA), FOTOS);
  assert.equal(r.ok, false);
  assert.match(r.ok === false ? r.motivo : "", /gênero/i);
});

test("o gênero do CADASTRO destrava o que a ficha não trouxe", () => {
  // São 408 anúncios desta base exatamente aqui.
  const doCadastro = fichaDoCadastro([{ nomeAtributo: "Gênero", valorAtributo: "Feminino" }]);
  const r = montarBundleUserProducts(anuncio(SO_MARCA), { ...FOTOS, doCadastro });
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
});

test("A FICHA MANDA: o cadastro não sobrescreve o que o modelo escreveu", () => {
  // O anúncio é o trabalho sobre ESTE produto; o cadastro é a resposta de antes.
  const comFicha = anuncio([...SO_MARCA, { atributo: "Gênero", valor: "Masculino" }]);
  const doCadastro = fichaDoCadastro([{ nomeAtributo: "Gênero", valorAtributo: "Feminino" }]);
  const r = montarBundleUserProducts(comFicha, { ...FOTOS, doCadastro });
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
  assert.equal(r.ok && r.bundle.generoNome, "Masculino", "o cadastro sobrescreveu a ficha");

  // E o mesmo anúncio SEM cadastro dá o mesmo gênero: a presença do cadastro
  // não muda nada quando a ficha respondeu.
  const semCadastro = montarBundleUserProducts(comFicha, FOTOS);
  assert.equal(
    semCadastro.ok && semCadastro.bundle.generoId,
    r.ok && r.bundle.generoId
  );
});

test("pendência na ficha não conta como resposta — o cadastro assume", () => {
  const comPendencia = anuncio([
    ...SO_MARCA,
    { atributo: "Gênero", valor: "⚠️ informação necessária: gênero" },
  ]);
  const doCadastro = fichaDoCadastro([{ nomeAtributo: "Gênero", valorAtributo: "Feminino" }]);
  const r = montarBundleUserProducts(comPendencia, { ...FOTOS, doCadastro });
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
});

test("cadastro vazio ou em branco não destrava nada", () => {
  const branco = fichaDoCadastro([{ nomeAtributo: "Gênero", valorAtributo: "   " }]);
  assert.equal(branco.size, 0);
  assert.equal(montarBundleUserProducts(anuncio(SO_MARCA), { ...FOTOS, doCadastro: branco }).ok, false);
});

test("acento e caixa não decidem — 'GÊNERO' e 'genero' são a mesma pergunta", () => {
  const doCadastro = fichaDoCadastro([{ nomeAtributo: "GÊNERO", valorAtributo: "Feminino" }]);
  assert.equal(montarBundleUserProducts(anuncio(SO_MARCA), { ...FOTOS, doCadastro }).ok, true);
});

test("a marca também sai do cadastro quando a ficha não a traz", () => {
  const doCadastro = fichaDoCadastro([
    { nomeAtributo: "Marca", valorAtributo: "Ipanema" },
    { nomeAtributo: "Gênero", valorAtributo: "Feminino" },
  ]);
  const r = montarBundleUserProducts(anuncio([]), { ...FOTOS, doCadastro });
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
});

test("fichaDoCadastro fica com a PRIMEIRA resposta de cada atributo", () => {
  const m = fichaDoCadastro([
    { nomeAtributo: "Gênero", valorAtributo: "Feminino" },
    { nomeAtributo: "Gênero", valorAtributo: "Masculino" },
  ]);
  assert.equal(m.get("genero"), "Feminino");
});
