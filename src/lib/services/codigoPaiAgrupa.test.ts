// O `Código Pai` do ERP é quem diz o que é UM produto — e o Zion agrupava por
// nome da derivação.
//
// ===========================================================================
// O DEFEITO, MEDIDO NA BASE DA LOJISTA EM 19/08/2026
// ===========================================================================
//
// SETE produtos do ERP viraram QUATORZE no Zion. Todos rachados em exatamente
// dois, o que denuncia regra e não acidente:
//
//   Papete Slide Modare 7208.101 (pai 2344016)
//     → "Chinelo Ortopédico Feminino Slide Modare Ultraconforto Laço" (14 SKUs)
//     → "Papete Slide Modare 7208.101 Nobuck" (10 SKUs)
//
//   Chinelo Tamanco Modare 7142.106 NP/Sense (pai 2035241)
//     → "Chinelo Ortopedico Modare Feminino Esporao Massageador" (20)
//     → "Chinelo Tamanco Modare 7142.106 Np/sense Flex" (14)
//
//   Tenis Actvitta 4841.103 Loc Salem (pai 2601946)
//     → "Tênis Feminino Calce Facil Casual Slip On Macio Actvitta" (25)
//     → "Tenis Feminino Actvitta 4841.103 Loc Salem" (2)
//
// E mais quatro. A consequência não é cosmética: cada metade ficou com um
// pedaço das cores e dos tamanhos, os estoques divergiram entre as metades, o
// mesmo EAN passou a existir em "dois produtos", e 14 variações não puderam
// receber SKU porque o código "pertencia a outro produto" — que era o mesmo.
//
// A CAUSA: o export do LINX chama a coluna da derivação de `Código`, e o
// mapeador não conhecia esse nome. Sem `skuVariacao` reconhecido, o arquivo
// inteiro caía em modo FLAT — uma linha, um produto — e o agrupamento passava a
// ser pelo NOME DA DERIVAÇÃO, que é escolha de quem digitou.
//
// O apelido `codigo_pai` já existia no mapeador. Faltava a outra metade do par.

import test from "node:test";
import assert from "node:assert/strict";
import { analisarProdutosCsv } from "./importacaoProdutos.ts";

/** O cabeçalho REAL do export de derivação do LINX, com acento e espaço. */
const CABECALHO = "Código;Código Pai;Nome da Derivação;EAN;Qtde Estoque";

test("`Código Pai` do LINX agrupa as variações num produto só", () => {
  // Duas cores do MESMO pai. No ERP é um produto; pelo nome da derivação,
  // seriam dois — e foi assim que o Papete virou dois.
  const csv = [
    CABECALHO,
    "01034234;2344016;avela soft 34;7900350710396;12",
    "01053834;2344016;alecrim 34;7900350710500;20",
  ].join("\n");

  const a = analisarProdutosCsv(csv);
  assert.equal(a.modo, "agrupado", "o par `Código` + `Código Pai` deixou de ser reconhecido");
  assert.equal(a.total, 1, "o `Código Pai` parou de agrupar — duas cores viraram dois produtos");
  assert.equal(a.totalVariacoes, 2);
});

// A prova de que é o PAI que agrupa, e não semelhança de texto: pais diferentes
// com descrição parecida têm de continuar sendo dois produtos.
test("pais diferentes não se juntam, mesmo com descrição parecida", () => {
  const csv = [
    CABECALHO,
    "01034234;2344016;avela soft 34;789;12",
    "01022236;2500000;avela soft 36;790;5",
  ].join("\n");
  assert.equal(analisarProdutosCsv(csv).total, 2);
});

// A REGRA É ESTREITA, e este teste é o que a mantém estreita.
//
// `codigo` sozinho é genérico: numa planilha de produtos simples ele é o código
// do PRÓPRIO produto, e promovê-lo a "SKU da variação" forçaria modo agrupado
// onde não há grade — inventando variações a partir de linhas independentes.
//
// Escrevi este teste esperando "agrupado" e ele reprovou apontando o certo: sem
// a coluna do pai, o modo SEMPRE foi flat. A asserção é que NADA muda para quem
// não manda o par do LINX.
test("sem `Código Pai`, `Código` sozinho NÃO vira SKU de variação", () => {
  const csv = [
    "Código;Nome da Derivação;EAN;Qtde Estoque",
    "01034234;Papete Modare;789;12",
    "01034235;Papete Modare;790;5",
  ].join("\n");
  const a = analisarProdutosCsv(csv);
  assert.equal(a.modo, "flat", "`codigo` sozinho passou a forçar modo agrupado");
  assert.equal(a.total, 2, "duas linhas independentes viraram um produto com grade");
});

// A outra ponta da mesma trava: `Código Pai` também começa com "codigo", e usar
// a MESMA coluna nos dois papéis faria cada variação ser o próprio pai — um
// produto por linha, que é exatamente o defeito que estamos consertando.
test("a coluna do pai não serve também de variação", () => {
  const csv = [
    "Código Pai;Nome da Derivação;EAN;Qtde Estoque",
    "2344016;avela soft 34;789;12",
    "2344016;alecrim 34;790;20",
  ].join("\n");
  assert.equal(
    analisarProdutosCsv(csv).modo,
    "flat",
    "a coluna do pai virou SKU de variação de si mesma"
  );
});
