// O caminho que faltava entre o SKU do ML e a variante no banco.
//
// ===========================================================================
// O CASO REAL, 18/08/2026
// ===========================================================================
//
// 108 variantes sem SKU. A leitura foi consertada (`include_attributes=all`) e
// o dado passou a chegar — 96 de 96. Mesmo assim a lojista clicou em importar
// e NADA foi escrito: zero linha tocada nas três tabelas. O modo `novos` pula
// anúncio já conhecido antes de olhar as variações, e `substituir` apaga o
// catálogo inteiro (com o custo e o peso que o ML não devolve) para consertar
// um campo.
//
// Estes testes guardam o terceiro caminho: preencher o que está vazio, casando
// só dentro do produto que já é dono do anúncio, e recusar o ambíguo.

import test from "node:test";
import assert from "node:assert/strict";
import {
  planejarCompletarSku,
  fraseDoCompletarSku,
  type AnuncioLidoDoML,
  type VarianteNoBanco,
} from "./completarSkuDoMarketplace.ts";

const PROD = "produto-1";

function variante(p: Partial<VarianteNoBanco> & { id: string }): VarianteNoBanco {
  return { produtoId: PROD, cor: "", tamanho: "", sku: "", ean: "", ...p };
}

function anuncio(p: Partial<AnuncioLidoDoML> & { mlItemId: string }): AnuncioLidoDoML {
  return { sku: "", ean: "", cor: "", tamanho: "", variacoes: [], ...p };
}

const mapa = new Map([["MLB1", PROD]]);

test("o SKU da variação do ML preenche a variante vazia que casa em cor e tamanho", () => {
  const plano = planejarCompletarSku(
    [
      anuncio({
        mlItemId: "MLB1",
        variacoes: [{ cor: "Preto/Camel", tamanho: "33 BR", sku: "00820433", ean: "789" }],
      }),
    ],
    mapa,
    [variante({ id: "v1", cor: "Preto/Camel", tamanho: "33 BR" })]
  );
  assert.deepEqual(plano.paraGravar, [{ id: "v1", sku: "00820433", ean: "789" }]);
  assert.equal(plano.comSku, 1);
  assert.equal(plano.continuamVazias, 0);
});

// O caso do print da lojista: o painel mostrava `39,0 BR` e a base tinha
// `39.0 BR`. Mesmo pé, textos diferentes — e é justamente nas variantes velhas
// que o rótulo divergiu, que são as que estão sem SKU.
test("casa 39,0 BR com 39.0 BR — o rótulo do tamanho mudou, o pé não", () => {
  const plano = planejarCompletarSku(
    [
      anuncio({
        mlItemId: "MLB1",
        variacoes: [{ cor: "Branco", tamanho: "39,0 BR", sku: "00866639", ean: "" }],
      }),
    ],
    mapa,
    [variante({ id: "v1", cor: "Branco", tamanho: "39.0 BR" })]
  );
  assert.deepEqual(plano.paraGravar, [{ id: "v1", sku: "00866639" }]);
});

// A faixa é uma prateleira DIFERENTE da unidade: `39 - 40` é o par de chinelo,
// `39` é um pé só. Casar os dois pelo primeiro número entraria estoque errado.
test("faixa não casa com unidade — 39 - 40 não é 39", () => {
  const plano = planejarCompletarSku(
    [
      anuncio({
        mlItemId: "MLB1",
        variacoes: [{ cor: "Preto", tamanho: "39 - 40", sku: "01062839", ean: "" }],
      }),
    ],
    mapa,
    [variante({ id: "v1", cor: "Preto", tamanho: "39 BR" })]
  );
  assert.deepEqual(plano.paraGravar, []);
  assert.equal(plano.semCasar.length, 1);
});

// A variante com SKU manda. O do ERP foi conferido código a código em
// 15/08/2026 (127 de 127 corretos); o do ML é o que a lojista digitou no
// painel. Sobrescrever trocaria o auditado pelo não auditado.
test("nunca sobrescreve — variante que já tem SKU fica como está", () => {
  const plano = planejarCompletarSku(
    [
      anuncio({
        mlItemId: "MLB1",
        variacoes: [{ cor: "Preto", tamanho: "33 BR", sku: "99999999", ean: "" }],
      }),
    ],
    mapa,
    [variante({ id: "v1", cor: "Preto", tamanho: "33 BR", sku: "01062833" })]
  );
  assert.deepEqual(plano.paraGravar, []);
});

// Mas o EAN vazio ao lado de um SKU preenchido AINDA pode ser completado: são
// dois campos, e um estar cheio não diz nada sobre o outro.
test("completa só o EAN quando o SKU já existe", () => {
  const plano = planejarCompletarSku(
    [
      anuncio({
        mlItemId: "MLB1",
        variacoes: [{ cor: "Preto", tamanho: "33 BR", sku: "99999999", ean: "7891234" }],
      }),
    ],
    mapa,
    [variante({ id: "v1", cor: "Preto", tamanho: "33 BR", sku: "01062833", ean: "" })]
  );
  // Não entra: `planejarCompletarSku` só indexa variantes SEM sku, porque quem
  // já tem código não é o problema que este caminho existe para resolver.
  assert.deepEqual(plano.paraGravar, []);
});

// As 11 duplicatas medidas na base: mesma cor, mesmo tamanho, duas linhas.
// Escolher uma é adivinhar qual sobrevive — e adivinhar em cima de duplicata
// foi o que, em 15/08/2026, colou código de tênis Molekinha em chinelo Modare.
test("duas variantes vazias iguais: não escreve em nenhuma, e diz", () => {
  const plano = planejarCompletarSku(
    [
      anuncio({
        mlItemId: "MLB1",
        variacoes: [{ cor: "Branco", tamanho: "33 BR", sku: "01062933", ean: "" }],
      }),
    ],
    mapa,
    [
      variante({ id: "v1", cor: "Branco", tamanho: "33 BR" }),
      variante({ id: "v2", cor: "Branco", tamanho: "33 BR" }),
    ]
  );
  assert.deepEqual(plano.paraGravar, []);
  assert.equal(plano.semCasar.length, 1);
});

// O vínculo vem de `anuncios_gerados`, não do nome. Um anúncio cujo MLB a base
// não conhece não pode escolher produto por semelhança de título — foi assim
// que o casamento frouxo errou antes.
test("anúncio sem produto conhecido não escreve em lugar nenhum", () => {
  const plano = planejarCompletarSku(
    [
      anuncio({
        mlItemId: "MLB-DESCONHECIDO",
        variacoes: [{ cor: "Preto", tamanho: "33 BR", sku: "00000001", ean: "" }],
      }),
    ],
    mapa,
    [variante({ id: "v1", cor: "Preto", tamanho: "33 BR" })]
  );
  assert.deepEqual(plano.paraGravar, []);
  assert.equal(plano.anunciosSemProduto, 1);
});

// O anúncio avulso (sem grade) é ele mesmo uma variação — foi assim que os
// SKUs dos anúncios por tamanho já entravam certo.
test("anúncio sem grade usa o SKU do próprio item", () => {
  const plano = planejarCompletarSku(
    [anuncio({ mlItemId: "MLB1", cor: "Preto", tamanho: "37,0 BR", sku: "00895337", ean: "" })],
    mapa,
    [variante({ id: "v1", cor: "Preto", tamanho: "37,0 BR" })]
  );
  assert.deepEqual(plano.paraGravar, [{ id: "v1", sku: "00895337" }]);
});

// Quando o ML também não sabe, a frase precisa dizer ISSO — e não "nada a
// fazer". A diferença entre "não tem lá" e "não trouxemos" foi o que me fez
// errar três vezes no mesmo dia.
test("a frase separa 'o ML não tem' de 'nada a completar'", () => {
  const nada = planejarCompletarSku([], mapa, [variante({ id: "v1", cor: "X", tamanho: "33" })]);
  assert.match(fraseDoCompletarSku(nada), /continuam sem código — nem lá elas têm/);

  const cheio = planejarCompletarSku([], mapa, [
    variante({ id: "v1", cor: "X", tamanho: "33", sku: "1" }),
  ]);
  assert.match(fraseDoCompletarSku(cheio), /já têm SKU/);
});
