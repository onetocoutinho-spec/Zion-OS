// Palavra no lugar do código — o recado que o ERP manda e o importador lê errado.
//
// MEDIDO em 27/08/2026 no catálogo real: 1003 produtos, e 22 com isto no SKU e
// no Código do ERP, os dois campos iguais:
//
//     inativoo  iinnattivo  inatt  inativo7  inativ  inativado  innattivoo
//     iinativoo  inattivvo  iiinativo  INAATIVO  iinnativo  inativoooo
//     INATIVVO  iinnaattivo  iinativo  inaattivo  inatiivo  inativos
//     inativva  inattivoo  innativo  ·  e um "PRESENTE"
//
// Ninguém digita isso 22 vezes por acidente. É alguém marcando "produto fora de
// linha" no campo do código, com uma letra a mais a cada vez porque o ERP não
// aceita dois códigos iguais. A grafia errada é o contorno da restrição.
//
// O estrago medido: os 22 viraram produto normal, entraram na contagem do
// catálogo e na lista de "faltam fotos", e 19 RECEBERAM foto.
//
// Rodar: npx tsx --test src/modules/catalog/domain/codigoQueEPalavra.test.ts

import test from "node:test";
import assert from "node:assert/strict";

import {
  avisoDeCodigoQueEPalavra,
  ehPalavraNoLugarDoCodigo,
  type LinhaComCodigo,
} from "./codigoQueEPalavra.ts";

const linha = (p: Partial<LinhaComCodigo> = {}): LinhaComCodigo => ({
  nome: "Tênis Molekinho 2638.103 Duplo Velcro",
  sku: "2638103",
  codErp: "2638103",
  ...p,
});

/**
 * Um catálogo COM CONVENÇÃO NUMÉRICA, mais as linhas que se quer testar.
 *
 * O aviso só dispara quando "sem dígito" é DESVIO, e desvio se mede contra o
 * resto. As fixtures anteriores tinham 1 a 12 linhas, todas marcadores — o que
 * nenhum ERP produz, e o que fazia o teste provar uma regra mais frouxa do que
 * a que o produto precisa. Medido na base real: 983 de 983 SKUs com dígito, e
 * 22 marcadores no meio.
 */
const catalogo = (...testadas: LinhaComCodigo[]): LinhaComCodigo[] => [
  ...Array.from({ length: 80 }, (_, i) =>
    linha({ nome: `Produto normal ${i}`, sku: `250${1000 + i}`, codErp: `250${1000 + i}` })
  ),
  ...testadas,
];

test("código de verdade tem dígito — nenhum deles é palavra", () => {
  // Os formatos que este catálogo usa de fato. Se algum virar "palavra", o
  // aviso passa a gritar em importação boa e ninguém o lê mais.
  for (const c of ["7208.101", "MF9184", "2588100", "010.012", "1319.1000", "BLC-9931", "22591.408"]) {
    assert.equal(ehPalavraNoLugarDoCodigo(c), false, `"${c}" foi lido como palavra`);
  }
});

test("as 22 grafias medidas são todas reconhecidas", () => {
  // A regra NÃO tenta reconhecer a palavra "inativo" — reconhecer palavras seria
  // perseguir grafias para sempre. Ela olha a ausência de dígito, e é por isso
  // que pega as 22 de uma vez, e o "PRESENTE" junto.
  const medidas = [
    "inativoo", "iinnattivo", "inatt", "inativ", "inativado", "innattivoo",
    "iinativoo", "inattivvo", "iiinativo", "INAATIVO", "iinnativo", "inativoooo",
    "INATIVVO", "iinnaattivo", "iinativo", "inaattivo", "inatiivo", "inativos",
    "inativva", "inattivoo", "innativo", "PRESENTE",
  ];
  for (const p of medidas) {
    assert.equal(ehPalavraNoLugarDoCodigo(p), true, `"${p}" passou como código`);
  }
});

test('"inativo7" tem dígito e NÃO é pego — e isso está certo', () => {
  // Uma das 22 grafias reais leva um número no fim. A regra a deixa passar, e a
  // alternativa seria caçar a palavra — o caminho que não termina.
  //
  // Fica escrito aqui para ninguém "consertar" isso depois sem saber o custo:
  // pegar "inativo7" exige reconhecer a PALAVRA, e aí "Kit 3" e "Duo 2" entram
  // junto. Uma linha a menos no aviso é mais barata que um aviso que grita à toa.
  assert.equal(ehPalavraNoLugarDoCodigo("inativo7"), false);
});

test("catálogo limpo não gera aviso — o silêncio é a resposta comum", () => {
  assert.equal(avisoDeCodigoQueEPalavra(catalogo(linha({ sku: "010.012" }))), null);
});

test("catálogo de MÓVEL não gera aviso — ali código sem dígito é a convenção", () => {
  // O contraexemplo que a primeira versão desta regra não tinha, e que estava
  // dentro do próprio repositório: `casarPastaComProduto.test.ts` usa estes
  // SKUs. Com a regra antiga (só "sem dígito"), TODOS seriam marcados — e
  // `apagarProdutosMarcadores.mjs`, que usa a mesma classificação para decidir
  // o que apagar, teria removido o catálogo inteiro.
  const movel: LinhaComCodigo[] = [
    { nome: "Cama - BELLA", sku: "CAT-CAMA-BELLA-CASAL-MOGNO", codErp: "CAT-CAMA-BELLA-CASAL-MOGNO" },
    { nome: "Cama - NAZARÉ", sku: "CAT-CAMA-NAZARE-SOLTEIRO", codErp: "CAT-CAMA-NAZARE-SOLTEIRO" },
    { nome: "Jogo de mesa dobrável", sku: "CAT-JOGO-DE-MESA-DOBRAVEL", codErp: "CAT-JOGO-DE-MESA-DOBRAVEL" },
  ];
  assert.equal(avisoDeCodigoQueEPalavra(movel), null);
});

test("um marcador NO MEIO de um catálogo de móvel também fica quieto", () => {
  // Não dá para distinguir: ali "sem dígito" é a convenção, e um marcador de
  // texto se parece com todos os outros. Perder este é o preço de não apagar
  // um catálogo inteiro — e o preço certo, porque o outro erro é irreversível.
  const movel: LinhaComCodigo[] = [
    { nome: "Cama - BELLA", sku: "CAT-CAMA-BELLA-CASAL-MOGNO" },
    { nome: "Cama - NAZARÉ", sku: "CAT-CAMA-NAZARE-SOLTEIRO" },
    { nome: "Descontinuada", sku: "inativoo" },
  ];
  assert.equal(avisoDeCodigoQueEPalavra(movel), null);
});

test("o valor sozinho NÃO decide — é `ehPalavra` que engana", () => {
  // A função de um valor só continua dizendo "sim" para o SKU de móvel. Ela é
  // um sinal, não um veredito, e este teste guarda a diferença: quem confundir
  // os dois recria o defeito.
  assert.equal(ehPalavraNoLugarDoCodigo("CAT-CAMA-BELLA-CASAL-MOGNO"), true);
  assert.equal(avisoDeCodigoQueEPalavra([
    { nome: "Cama", sku: "CAT-CAMA-BELLA-CASAL-MOGNO" },
  ]), null);
});

test("o aviso conta as linhas e mostra as palavras encontradas", () => {
  const a = avisoDeCodigoQueEPalavra(
    catalogo(
      linha({ nome: "Chinelos Havaianas Slim Visuals", sku: "iinnattivo", codErp: "iinnattivo" }),
      linha({ nome: "Mocassim Modare 7397.101 Floather", sku: "inatt", codErp: "inatt" })
    )
  );
  assert.ok(a);
  assert.equal(a.linhas, 2);
  assert.deepEqual(a.palavras.sort(), ["iinnattivo", "inatt"]);
  assert.equal(a.exemplos.length, 2);
});

test("a frase diz a CONSEQUÊNCIA, não o fato", () => {
  // "22 SKUs inválidos" não move ninguém. O que move é saber que eles vão pedir
  // foto e preço, e chegar perto da publicação.
  const a = avisoDeCodigoQueEPalavra(catalogo(linha({ sku: "inativoo", codErp: "inativoo" })));
  assert.ok(a);
  assert.match(a.texto, /entram como produto normal/);
  assert.match(a.texto, /pedem foto e preço/);
  assert.match(a.texto, /publicação/);
  assert.match(a.texto, /"inativoo"/);
});

test("basta UM dos dois campos ser palavra", () => {
  // Nos 22 medidos os dois vinham iguais. Um ERP que preencha só um produz o
  // mesmo estrago, e o aviso precisa pegar os dois casos.
  assert.ok(avisoDeCodigoQueEPalavra(catalogo(linha({ sku: "2638103", codErp: "inativo" }))));
  assert.ok(avisoDeCodigoQueEPalavra(catalogo(linha({ sku: "inativo", codErp: "2638103" }))));
});

test("uma letra só não é palavra — coluna com lixo de uma letra não vira alarme", () => {
  assert.equal(ehPalavraNoLugarDoCodigo("x"), false);
  assert.equal(ehPalavraNoLugarDoCodigo(""), false);
  assert.equal(ehPalavraNoLugarDoCodigo(undefined), false);
});

test("muitas palavras distintas não viram uma frase interminável", () => {
  const muitas = Array.from({ length: 12 }, (_, i) =>
    linha({ nome: `Produto ${i}`, sku: "in" + "a".repeat(i + 1) + "tivo", codErp: "" })
  );
  const a = avisoDeCodigoQueEPalavra(catalogo(...muitas));
  // 80 normais para 12 marcadores é 87% — a proporção real é ainda mais folgada
  // (22 em 1003, ou 98%). O corte não é o que este teste mede; ele mede a frase.
  assert.ok(a);
  assert.equal(a.linhas, 12);
  assert.match(a.texto, /entre outras/);
  assert.equal(a.exemplos.length, 3);
});
