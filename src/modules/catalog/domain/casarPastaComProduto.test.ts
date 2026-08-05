// A foto de uma cama não pode aparecer no anúncio de outra.
//
// Esta função decide para qual produto vai uma PASTA INTEIRA de fotos, e até
// 05/08/2026 ela morava dentro de um componente de página — inalcançável por
// teste. O catálogo de móveis é onde ela mais sofre: "Cama - BELLA",
// "Cama - NAZARÉ" e "Cama Box" dividem a palavra que mais aparece.

import test from "node:test";
import assert from "node:assert/strict";
import {
  CORTE_DE_PARECENCA,
  casarPastaComProduto,
  lerCaminhoDaFoto,
  type ProdutoParaCasar,
} from "./casarPastaComProduto.ts";

const CATALOGO: ProdutoParaCasar[] = [
  { id: "p1", nome: "Cama - BELLA", sku: "CAT-CAMA-BELLA-CASAL-MOGNO" },
  { id: "p2", nome: "Cama - NAZARÉ", sku: "CAT-CAMA-NAZARE-SOLTEIRO" },
  { id: "p3", nome: "Beliche - VITORIA", sku: "CAT-BELICHE-VITORIA", codErp: "BLC-9931" },
  { id: "p4", nome: "Jogo de mesa dobrável 115x70", sku: "CAT-JOGO-DE-MESA-DOBRAVEL" },
];

test("o código na pasta encerra a pergunta — identidade não tem grau", () => {
  const r = casarPastaComProduto("CAT-CAMA-NAZARE-SOLTEIRO", CATALOGO);
  assert.equal(r.produtoId, "p2");
  assert.equal(r.confianca, 1);
  assert.equal(r.via, "codigo");
});

test("o código do ERP também casa — é identidade igual", () => {
  assert.equal(casarPastaComProduto("fotos BLC-9931", CATALOGO).produtoId, "p3");
});

test("código vence parecença de nome, mesmo com o nome puxando para outro", () => {
  // A pasta fala "Cama BELLA" mas carrega o código da NAZARÉ. Quem manda é o
  // código: o nome é palpite, o código é identidade.
  const r = casarPastaComProduto("Cama BELLA CAT-CAMA-NAZARE-SOLTEIRO", CATALOGO);
  assert.equal(r.produtoId, "p2");
  assert.equal(r.via, "codigo");
});

test("código curto demais NÃO casa — casaria por acaso", () => {
  const curto: ProdutoParaCasar[] = [{ id: "x", nome: "Coisa", sku: "A1" }];
  assert.equal(casarPastaComProduto("pasta A1 qualquer", curto).produtoId, null);
});

test("sem código, casa por nome e devolve o quanto aquilo é palpite", () => {
  const r = casarPastaComProduto("BELICHE VITORIA", CATALOGO);
  assert.equal(r.produtoId, "p3");
  assert.equal(r.via, "nome");
  assert.ok(r.confianca > CORTE_DE_PARECENCA && r.confianca <= 1);
});

test("parecença fraca não casa — 'não casou' é o erro seguro", () => {
  // "Cama" sozinha serve para três produtos. Casar seria escolher no palpite.
  const r = casarPastaComProduto("Camas", CATALOGO);
  assert.equal(r.produtoId, null);
  assert.equal(r.via, null);
});

test("a confiança volta mesmo quando não casa — a tela precisa mostrar o quase", () => {
  const r = casarPastaComProduto("mesa", CATALOGO);
  assert.equal(r.produtoId, null);
  assert.ok(r.confianca >= 0 && r.confianca < CORTE_DE_PARECENCA);
});

test("pasta sem palavra útil não casa com nada", () => {
  assert.deepEqual(casarPastaComProduto("a b", CATALOGO), {
    produtoId: null,
    confianca: 0,
    via: null,
  });
});

test("acento e caixa não atrapalham", () => {
  assert.equal(casarPastaComProduto("cama nazare", CATALOGO).produtoId, "p2");
  assert.equal(casarPastaComProduto("CAMA NAZARÉ", CATALOGO).produtoId, "p2");
});

// ---------------------------------------------------------------------------
// A leitura do caminho — o defeito que aparecia só com DOIS níveis.
//
// `webkitRelativePath` inclui a pasta escolhida como primeiro segmento. Contar
// a partir do FIM funcionava com três níveis e invertia tudo com dois: o nome
// da pasta escolhida virava o produto, o produto virava a cor, e o lote inteiro
// colapsava num grupo só.
//
// Móvel cai justamente aí — nem todo produto tem cor, então a subpasta de cor
// muitas vezes não existe.
// ---------------------------------------------------------------------------

test("três níveis: produto e cor, como sempre foi", () => {
  assert.deepEqual(lerCaminhoDaFoto("Fotos/CAMA BELLA/Castanho/01.jpg"), {
    pastaProduto: "CAMA BELLA",
    cor: "Castanho",
  });
});

test("DOIS níveis: o produto é o produto — não a pasta que a pessoa escolheu", () => {
  assert.deepEqual(lerCaminhoDaFoto("Fotos/CAMA BELLA/01.jpg"), {
    pastaProduto: "CAMA BELLA",
    cor: "",
  });
});

test("dois produtos com dois níveis não colapsam num grupo só", () => {
  const a = lerCaminhoDaFoto("Fotos/CAMA BELLA/01.jpg");
  const b = lerCaminhoDaFoto("Fotos/BELICHE VITORIA/01.jpg");
  assert.notEqual(a.pastaProduto, b.pastaProduto, "os dois produtos viraram o mesmo grupo");
});

test("mais fundo que três: o primeiro nível ainda é o produto", () => {
  assert.deepEqual(lerCaminhoDaFoto("Fotos/CAMA BELLA/Castanho/detalhe/01.jpg"), {
    pastaProduto: "CAMA BELLA",
    cor: "Castanho",
  });
});

test("foto solta na raiz não inventa produto", () => {
  assert.equal(lerCaminhoDaFoto("Fotos/01.jpg").pastaProduto, "(raiz)");
  assert.equal(lerCaminhoDaFoto("01.jpg").pastaProduto, "(raiz)");
});
