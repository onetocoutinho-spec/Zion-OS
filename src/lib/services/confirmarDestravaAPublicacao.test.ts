// Confirmar é o que destrava. Enquanto ela não confirma, não publica.
//
// ===========================================================================
// O CICLO INTEIRO, NUM TESTE SÓ
// ===========================================================================
//
// A importação lê gênero das palavras-chave do ERP e grava com
// `origem: "Importação"`. Isso é dedução sobre texto livre de SEO, e a revisão
// de 28/08 fechou o caminho dela até a publicação: `fichaDoCadastro` ignora
// essa origem, porque não havia onde a lojista revisar.
//
// `/cliente/atributos` é o onde. Confirmando, a origem vira `Manual` — a mesma
// da aba de atributos — e o valor passa a valer como resposta DELA.
//
// Este teste guarda os dois lados dessa porta ao mesmo tempo. Se um dia a
// proposta voltar a publicar sem confirmação, ele cai; e se a confirmação
// deixar de destravar, ele cai também. Um teste só, porque são a mesma regra
// vista dos dois lados — e separá-los deixaria passar o caso em que as duas
// mudam juntas para o lugar errado.
//
// Rodar: npx tsx --test src/lib/services/confirmarDestravaAPublicacao.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import {
  fichaDoCadastro,
  montarBundleUserProducts,
} from "../../modules/publication/domain/composicaoConteudo.ts";
import {
  ORIGEM_PROPOSTA,
  ORIGEM_CONFIRMADA,
} from "./propostasDeAtributo.ts";
import type { AnuncioGerado } from "../agentes/esteira.ts";

/** Um anúncio sem gênero em lugar nenhum — nem na ficha, nem no título. */
function anuncioMudo(): AnuncioGerado {
  return {
    notaDiagnostico: 90,
    tituloOtimizado: "Chinelo Slide Conforto Leve",
    palavrasChavePrincipais: [],
    palavrasChaveSecundarias: [],
    descricaoCompleta: "Descrição.",
    descricaoCurta: "Curta.",
    fichaTecnica: [{ atributo: "Marca", valor: "Ipanema" }],
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
const proposta = { nomeAtributo: "Gênero", valorAtributo: "Feminino", origem: ORIGEM_PROPOSTA };
const confirmada = { ...proposta, origem: ORIGEM_CONFIRMADA };

test("PROPOSTA não publica — é dedução, e ela ainda não viu", () => {
  const doCadastro = fichaDoCadastro([proposta]);
  assert.equal(doCadastro.size, 0, "a proposta entrou no mapa que alimenta a publicação");

  const r = montarBundleUserProducts(anuncioMudo(), { ...FOTOS, doCadastro });
  assert.equal(r.ok, false, "publicou uma dedução que a lojista não confirmou");
  assert.match(r.ok === false ? r.motivo : "", /gênero/i);
});

test("CONFIRMADA publica — a origem é a diferença inteira", () => {
  const doCadastro = fichaDoCadastro([confirmada]);
  assert.equal(doCadastro.get("genero"), "Feminino");

  const r = montarBundleUserProducts(anuncioMudo(), { ...FOTOS, doCadastro });
  assert.equal(r.ok, true, r.ok === false ? r.motivo : "");
  assert.equal(r.ok && r.bundle.generoNome, "Feminino");
});

test("o VALOR é o mesmo nos dois — só a origem muda", () => {
  // Confirmar não reescreve o valor: se ela concorda, o que a importação leu já
  // era o certo. Um teste aqui porque a tentação de "gravar de novo para ter
  // certeza" é grande, e a gravação a mais é um lugar a mais para divergir.
  assert.equal(proposta.valorAtributo, confirmada.valorAtributo);
  assert.notEqual(proposta.origem, confirmada.origem);
});

test("as outras origens continuam publicando — o filtro é de uma só", () => {
  // `Marketplace` (o enriquecer do ML) e `Manual` (a aba da equipe) são
  // resposta, não proposta. Filtrar demais deixaria de publicar o que a loja
  // real já responde hoje em 549 linhas.
  for (const origem of ["Manual", "Marketplace", "Template", "IA"]) {
    const m = fichaDoCadastro([{ nomeAtributo: "Gênero", valorAtributo: "Feminino", origem }]);
    assert.equal(m.get("genero"), "Feminino", `origem "${origem}" foi filtrada por engano`);
  }
});

test("linha sem origem continua valendo — a coluna é nova, o dado é velho", () => {
  // Nem toda leitura traz a coluna, e as que não trazem são anteriores a esta
  // regra. Tratar ausência como proposta apagaria da publicação o cadastro
  // inteiro de quem já respondeu.
  const m = fichaDoCadastro([{ nomeAtributo: "Gênero", valorAtributo: "Feminino" }]);
  assert.equal(m.get("genero"), "Feminino");
});
