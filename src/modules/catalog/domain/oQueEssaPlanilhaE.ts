/**
 * O que esta planilha é — decidido pelos CABEÇALHOS, não por palpite.
 *
 * ===========================================================================
 * POR QUE UM ROTEADOR, E NÃO UM IMPORTADOR ÚNICO
 * ===========================================================================
 *
 * Custo e peso chegam pela mesma porta (o clipe do chat) e vão para domínios
 * com disciplinas DIFERENTES — e a diferença é deliberada:
 *
 *   CUSTO  aceita casar por NOME, e por isso exige conferência humana do
 *          mapeamento antes de gravar. Uma planilha com colunas deslocadas já
 *          gravou 87 "custos" que eram referências de modelo, um deles de
 *          R$ 30.277.872,00.
 *
 *   PESO   RECUSA casar por nome ("nomes parecidos já trocaram custo entre
 *          produtos diferentes") e RECUSA coluna de peso sem unidade no
 *          cabeçalho ("sem isso não dá para saber se 800 é 800 gramas ou 800
 *          quilos"). Ele não precisa de conferência de mapeamento: ou os
 *          cabeçalhos são inequívocos, ou ele recusa com instrução.
 *
 * Unificar os dois num importador só significaria escolher uma das duas
 * disciplinas e perder a outra. O roteador preserva as duas.
 *
 * ===========================================================================
 * O QUE ELE NÃO FAZ
 * ===========================================================================
 *
 * Não chama modelo. A decisão é dos cabeçalhos, e é a mesma toda vez — que é
 * exatamente o motivo de o mapeamento de custos ter saído do modelo depois do
 * estrago de R$ 30 milhões.
 *
 * Não decide sozinho quando a planilha tem OS DOIS. Uma planilha com custo e
 * peso é legítima, e escolher por ela gravaria metade do que ela trouxe em
 * silêncio. Nesse caso devolve `ambigua` e quem pergunta é a tela.
 */

import { sugerirMapeamento, colunaDoPapel } from "./mapeamentoPlanilha";
import { detectarColunas } from "./importacaoPeso";

/**
 * As colunas que SÓ um catálogo tem.
 *
 * ===========================================================================
 * POR QUE A REGRA DO CATÁLOGO É DIFERENTE DAS OUTRAS DUAS
 * ===========================================================================
 *
 * Custo e peso ATUALIZAM linhas que já existem. Catálogo CRIA produtos — é a
 * única das quatro importações que aumenta a base, e errar aqui não escreve um
 * número errado: escreve cinquenta produtos duplicados.
 *
 * E a ambiguidade é real, não hipotética: `analisarProdutosCsv` exige APENAS
 * `nome`. A planilha de custos que o próprio Zion gera para a lojista tem nome,
 * sku, marca, preço e custo — ela passaria como catálogo, e importá-la assim
 * duplicaria os cinquenta produtos que ela queria atualizar.
 *
 * Então catálogo não se reconhece por "tem nome". Reconhece-se por trazer
 * coluna que uma planilha de custo ou de peso NÃO TERIA MOTIVO de ter: cor,
 * tamanho, SKU de variação, código do ERP.
 */
const SO_DE_CATALOGO = [
  "cor",
  "cores",
  "tamanho",
  "tamanhos",
  "numeracao",
  "numeração",
  "sku_variacao",
  "sku variacao",
  "sku da variacao",
  "skuvariacao",
  "cod_erp",
  "coderp",
  "codigo erp",
  "código erp",
];

function pareceCatalogo(headers: readonly string[]): boolean {
  const normal = headers.map((h) => h.trim().toLowerCase());
  return normal.some((h) => SO_DE_CATALOGO.includes(h));
}

export type EspecieDaPlanilha =
  | { especie: "custo"; porque: string }
  | { especie: "peso"; porque: string }
  /** Catálogo de produtos. A única espécie que CRIA em vez de atualizar. */
  | { especie: "catalogo"; porque: string }
  | { especie: "ambigua"; porque: string }
  /** Nem uma coisa nem outra. `mensagem` é o que a lojista lê. */
  | { especie: "nenhuma"; mensagem: string };

export function oQueEssaPlanilhaE(headers: readonly string[]): EspecieDaPlanilha {
  const temCusto = !!colunaDoPapel(sugerirMapeamento(headers), "custo");
  const deteccaoPeso = detectarColunas(headers);
  const temPeso = deteccaoPeso.ok;
  const temCatalogo = pareceCatalogo(headers);

  // CATÁLOGO NUNCA GANHA NO EMPATE.
  //
  // Uma planilha com cor E custo pode ser as duas coisas, e a diferença entre
  // elas é criar cinquenta produtos ou atualizar cinquenta. Quando há dúvida,
  // quem decide é a lojista — nunca o desempate silencioso.
  if (temCatalogo && (temCusto || temPeso)) {
    return {
      especie: "ambigua",
      porque:
        "Esta planilha tem colunas de catálogo (cor, tamanho ou código do ERP) e também de " +
        (temCusto ? "custo" : "peso") +
        ". Importar como catálogo CRIA produtos; como " +
        (temCusto ? "custo" : "peso") +
        " atualiza os que já existem. Escolher por conta própria poderia duplicar sua base.",
    };
  }
  if (temCatalogo) {
    return {
      especie: "catalogo",
      porque: "Achei colunas de catálogo — cor, tamanho ou código do ERP.",
    };
  }

  if (temCusto && temPeso) {
    return {
      especie: "ambigua",
      porque:
        "Esta planilha tem coluna de custo E coluna de peso. Escolher por conta própria gravaria " +
        "só metade do que ela traz, sem dizer qual metade.",
    };
  }
  if (temCusto) {
    return { especie: "custo", porque: "Achei uma coluna de custo." };
  }
  if (temPeso) {
    return { especie: "peso", porque: "Achei uma coluna de peso com a unidade no nome." };
  }

  // NEM UMA NEM OUTRA — e aqui a mensagem do domínio do peso é melhor que
  // qualquer coisa que este arquivo saberia escrever. Ela é específica:
  // "renomeie para peso_kg", "a planilha precisa de SKU ou EAN". Repetir isso
  // aqui criaria a segunda fonte que este repo já pagou para não ter.
  return {
    especie: "nenhuma",
    mensagem: deteccaoPeso.ok
      ? "Não achei nem coluna de custo nem de peso nesta planilha."
      : `Não achei coluna de custo nesta planilha. Se a intenção era peso: ${deteccaoPeso.mensagem}`,
  };
}
