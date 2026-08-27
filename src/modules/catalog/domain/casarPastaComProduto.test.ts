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
  nivelDoProdutoPorProfundidade,
  pastasDoCaminho,
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

// ---------------------------------------------------------------------------
// Referência do fabricante — a forma como a pasta de fotos chega de verdade
// ---------------------------------------------------------------------------

/** Nomes reais da base medida em 26/08/2026. */
const CALCADOS = [
  { id: "c1", nome: "Papete Slide Modare 7208.101 Nobuck", sku: "2344016", codErp: "2344016" },
  { id: "c2", nome: "Sandália Molekinha 2312.260 Turim Fem", sku: "1969985", codErp: "1969985" },
  { id: "c3", nome: "Tamanco Slide Modare 7142.101 Canelado", sku: "2100001", codErp: "2100001" },
  { id: "c4", nome: "Tamanco Slide Modare 7142.101 Elástico", sku: "2100002", codErp: "2100002" },
  { id: "c5", nome: "Bolsa de Praia Tote Bag MF9184 Poá", sku: "2200003", codErp: "2200003" },
];

test("a referência do fabricante casa, e casa como identidade", () => {
  // Antes desta regra isto dava 2/6 = 0,33 de parecença e ficava ABAIXO do
  // corte de 0,34 — o jeito mais provável de a pasta chegar era o que não
  // funcionava. Medido: 10,8% de acerto contra 99,1% com o código do ERP.
  const r = casarPastaComProduto("7208.101", CALCADOS);
  assert.equal(r.produtoId, "c1");
  assert.equal(r.via, "referencia");
  assert.equal(r.confianca, 1);
});

test("referência com letras também é referência", () => {
  assert.equal(casarPastaComProduto("MF9184", CALCADOS).produtoId, "c5");
});

test("a pontuação da pasta não precisa bater com a do nome", () => {
  assert.equal(casarPastaComProduto("fotos 7208101", CALCADOS).produtoId, "c1");
  assert.equal(casarPastaComProduto("7208-101", CALCADOS).produtoId, "c1");
});

test("referência REPETIDA não casa — escolher um dos dois seria chute", () => {
  // "7142.101" é o mesmo modelo em dois acabamentos. Errar aqui põe a foto no
  // anúncio errado, então "não casou" é o desfecho certo.
  const r = casarPastaComProduto("7142.101", CALCADOS);
  assert.equal(r.produtoId, null);
  assert.equal(r.via, null);
});

test("o código do ERP continua vencendo a referência", () => {
  // A pasta traz os dois; identidade do próprio cadastro vem primeiro.
  const r = casarPastaComProduto("2344016 - 7142.101", CALCADOS);
  assert.equal(r.produtoId, "c1");
  assert.equal(r.via, "codigo");
});

test("palavra sem dígito nunca é referência", () => {
  // "TAMANCO" tem 7 letras e casaria por comprimento se o dígito não fosse
  // exigido — e viraria identidade de um produto qualquer.
  const r = casarPastaComProduto("TAMANCO", CALCADOS);
  assert.notEqual(r.via, "referencia");
});

test("número curto demais não vira referência", () => {
  const curto = [{ id: "x", nome: "Chinelo 12 Basic", sku: "9", codErp: "9" }];
  assert.equal(casarPastaComProduto("12", curto).via, null);
});

// ---------------------------------------------------------------------------
// Em que NÍVEL de pasta mora o produto — o catálogo decide
// ---------------------------------------------------------------------------

test("todas as pastas saem, INCLUSIVE a escolhida", () => {
  // A escolhida entra porque ela pode ser o produto: quem seleciona a pasta de
  // um produto só teria o nome dele descartado.
  assert.deepEqual(pastasDoCaminho("Fotos/CHINELO/Chinelo Klin 442127/4380 azul/01.png"), [
    "Fotos", "CHINELO", "Chinelo Klin 442127", "4380 azul",
  ]);
  assert.deepEqual(pastasDoCaminho("Fotos/Produto/01.png"), ["Fotos", "Produto"]);
  assert.deepEqual(pastasDoCaminho("01.png"), []);
});

test("selecionar a pasta de UM produto continua achando o produto", () => {
  // O caso de 27/08/2026: a pessoa selecionou `Papete Slide Modare 7208101
  // Nobuck` e a tela agrupou por "100983 verde luna nobu" — a COR — porque o
  // nome do produto era o segmento descartado.
  const catalogo = [
    { id: "a", nome: "Papete Slide Modare 7208.101 Nobuck", sku: "1", codErp: "1" },
  ];
  const meios = [["Papete Slide Modare 7208101 Nobuck", "100983 verde luna nobu"]];
  assert.equal(nivelDoProdutoPorProfundidade(meios, catalogo).get(2), 0);
});

test("com TIPO na frente, o nível do produto é o do meio", () => {
  // A pasta real de uma loja, medida em 27/08/2026: TIPO/Produto/Cor. Contar do
  // começo poria "CHINELO" no lugar do produto — e "CHINELO" não casa com
  // nenhum dos 1003 produtos, enquanto o nome completo casa com 427 de 457.
  const meios = [
    ["Fotos", "CHINELO", "Chinelo Havaianas Top Logomania", "preto"],
    ["Fotos", "CHINELO", "Chinelo Ipanema 27065 Disney", "rosa"],
    ["Fotos", "BABUCHE", "Babuche Boaonda 1716 John", "azul"],
  ];
  const catalogo = [
    { id: "a", nome: "Chinelo Havaianas Top Logomania", sku: "1", codErp: "1" },
    { id: "b", nome: "Chinelo Ipanema 27065 Disney", sku: "2", codErp: "2" },
    { id: "c", nome: "Babuche Boaonda 1716 John", sku: "3", codErp: "3" },
  ];
  assert.equal(nivelDoProdutoPorProfundidade(meios, catalogo).get(4), 2);
});

test("sem TIPO, o produto é o nível logo abaixo da escolhida", () => {
  // A forma que a tela sempre esperou. Ensinar o nível novo não pode quebrá-la.
  const meios = [["Fotos", "Chinelo Havaianas Top Logomania", "preto"]];
  const catalogo = [{ id: "a", nome: "Chinelo Havaianas Top Logomania", sku: "1", codErp: "1" }];
  assert.equal(nivelDoProdutoPorProfundidade(meios, catalogo).get(3), 1);
});

test("cada profundidade decide sozinha — a mesma pasta mistura as duas formas", () => {
  // 9.384 imagens em TIPO/Produto/Cor e 1.592 em ZZ/TIPO/Produto/Cor, no mesmo
  // upload. Uma decisão global poria metade no lugar errado.
  const catalogo = [{ id: "a", nome: "Babuche Boaonda 1716 John", sku: "1", codErp: "1" }];
  const meios = [
    ["Fotos", "BABUCHE", "Babuche Boaonda 1716 John", "azul"],
    ["Fotos", "ZZ_NAO_IDENTIFICADO", "BABUCHE", "Babuche Boaonda 1716 John", "azul"],
  ];
  const mapa = nivelDoProdutoPorProfundidade(meios, catalogo);
  assert.equal(mapa.get(4), 2);
  assert.equal(mapa.get(5), 3);
});

test("nenhum nível casando devolve 0 — o comportamento de antes", () => {
  // Sem prova, nada muda. Inventar um nível seria pior que a regra fixa.
  const meios = [["QUALQUER", "COISA", "AQUI"]];
  const catalogo = [{ id: "a", nome: "Chinelo Havaianas Top", sku: "1", codErp: "1" }];
  assert.equal(nivelDoProdutoPorProfundidade(meios, catalogo).get(3), 1);
});

test("a amostra não varre a pasta inteira", () => {
  // 3.338 pastas × 3 níveis × 1003 produtos seriam 10 milhões de comparações,
  // e a aba congelaria — que é o defeito que a importação de custos acabou de
  // pagar. A decisão sai de uma amostra por profundidade.
  const catalogo = [{ id: "a", nome: "Chinelo Havaianas Top", sku: "1", codErp: "1" }];
  const meios = Array.from({ length: 500 }, (_, i) => ["Fotos", "TIPO", `Chinelo Havaianas Top`, `c${i}`]);
  const t0 = Date.now();
  assert.equal(nivelDoProdutoPorProfundidade(meios, catalogo, 30).get(4), 2);
  assert.ok(Date.now() - t0 < 500, "a escolha do nível demorou demais");
});


// ---------------------------------------------------------------------------
// PASTA COM CÓDIGO NÃO CAI NA PARECENÇA — 27/08/2026
// ---------------------------------------------------------------------------
//
// O arquivo já dizia "Código vence nome sempre". A regra valia só quando o
// código ACERTAVA: quando a pasta trazia um código que não resolvia — produto
// fora do catálogo, ou referência repetida — o fluxo caía na parecença de nome
// e casava por PALAVRA, ignorando o código que a própria pasta declarou.
//
// MEDIDO sobre os 992 grupos de foto da base real da lojista, comparando o
// código da pasta com o do produto escolhido, dígito a dígito:
//
//     ANTES   código bate 403 · NÃO bate 53  ->  470 fotos no produto ERRADO
//     DEPOIS  código bate 369 · NÃO bate  0
//
// E o erro tinha cara de acerto, porque a palavra em comum era boa. Casos
// reais, todos de fotos que já tinham sido gravadas:
//
//     "Sandalia Beira Rio 8513113 Anel MT"  ->  8367.878 London
//     "Sandalia Modare 7162219 Floather"    ->  MOCASSIM 7397.101 Floather
//     "Sandalia Moleca 5504213 Napa Turim"  ->  5555.203 Napa Turim
//
// O custo é conhecido: 992 grupos casados viraram 759, e os 233 restantes
// passam a exigir uma pessoa no seletor da tela. É a troca certa — pasta sem
// produto aparece em amarelo e alguém resolve; foto no produto errado ninguém
// revisa, porque ela parece certa.

const SAPATOS: ProdutoParaCasar[] = [
  { id: "s1", nome: "Sandália Beira Rio 8367.878 London", sku: "2301001" },
  { id: "s2", nome: "Mocassim Modare 7397.101 Floather N", sku: "2301002" },
  { id: "s3", nome: "Sandália Moleca 5555.203 Napa Turim", sku: "2301003" },
  { id: "s4", nome: "Tamanco Slide Modare 7142.101 Canelado", sku: "2301004" },
  { id: "s5", nome: "Tamanco Slide Modare 7142.101 Elástico", sku: "2301005" },
];

test("pasta com código que NÃO existe no catálogo não casa por palavra", () => {
  // O caso da Beira Rio: a pasta diz 8513.113, que não está no catálogo. A
  // parecença puxava para a 8367.878 porque "Sandalia Beira Rio" é igual.
  const r = casarPastaComProduto("Sandalia Beira Rio 8513113 Anel MT Premium", SAPATOS);
  assert.equal(r.produtoId, null, "voltou a casar por parecença apesar do código");
  assert.equal(r.via, null);
});

test("uma sandália não vira mocassim por dividirem a palavra Floather", () => {
  const r = casarPastaComProduto("Sandalia Modare 7162219 Floather Elastic", SAPATOS);
  assert.equal(r.produtoId, null);
});

test("pasta com referência REPETIDA continua sem casar — e agora não desvia", () => {
  // 7142.101 está em dois produtos. `referenciasUnicas` já o descartava, e o
  // fluxo então caía na parecença e escolhia um dos dois por palavra. Escolher
  // um de dois é chute, e chute aqui põe foto no anúncio errado.
  const r = casarPastaComProduto("Tamanco Slide Modare 7142101 CaneladoElastico", SAPATOS);
  assert.equal(r.produtoId, null);
  assert.equal(r.via, null);
});

test("o código certo continua casando — a regra não fechou a porta boa", () => {
  // Sem isto, o conserto teria trocado erro por inutilidade.
  const r = casarPastaComProduto("Sandalia Beira Rio 8367878 London", SAPATOS);
  assert.equal(r.produtoId, "s1");
  assert.equal(r.via, "referencia");
  assert.equal(casarPastaComProduto("fotos 2301003", SAPATOS).produtoId, "s3");
});

test("pasta SEM código nenhum continua casando por nome — a parecença sobreviveu", () => {
  // A regra nova só vale onde há identidade declarada. Onde não há, a parecença
  // continua sendo a melhor resposta possível — é o caso das pastas de móvel,
  // que nomeiam o produto sem código.
  const r = casarPastaComProduto("Cama - NAZARÉ", CATALOGO);
  assert.equal(r.produtoId, "p2");
  assert.equal(r.via, "nome");
  assert.ok(r.confianca >= CORTE_DE_PARECENCA);
});

test("o SKU do ERP ganha do código que está no NOME do produto", () => {
  // Caso real e contraintuitivo: a pasta "Tenis Molekinha 2588100 Mumbai" casa
  // com um produto cujo NOME diz 2864.112 — porque o SKU dele é 2588100. O ERP
  // é a identidade; o nome é texto, e às vezes o texto está desatualizado.
  const comSkuDivergente: ProdutoParaCasar[] = [
    { id: "t1", nome: "Tenis Infantil Molekinho 2864.112 Nylon Sleek", sku: "2588100" },
    { id: "t2", nome: "Tenis Molekinha 2588.100 Mumbai", sku: "9999999" },
  ];
  const r = casarPastaComProduto("Tenis Molekinha 2588100 Mumbai", comSkuDivergente);
  assert.equal(r.produtoId, "t1");
  assert.equal(r.via, "codigo");
});
