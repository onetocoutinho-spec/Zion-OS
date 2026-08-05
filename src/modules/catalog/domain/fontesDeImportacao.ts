// De onde os produtos podem vir — nomeados pelo que a lojista TEM.
//
// ===========================================================================
// POR QUE ESTA LISTA EXISTE FORA DA TELA
// ===========================================================================
//
// O cabeçalho de "Meus Produtos" chegou a SETE botões, seis deles portas de
// entrada de dado, lado a lado como iguais. Não eram iguais: "Planilha",
// "Custos" e "Peso" são o mesmo verbo com três recortes, "Novo produto" é
// criar, e "Frete" não importa nada — consulta o ML e preenche um campo.
//
// O defeito não era a quantidade. Era o RÓTULO: cada botão tinha o nome do
// nosso recorte, não o nome do que a pessoa tem na mão. Ninguém sabe se o
// arquivo dela é "Planilha" ou "Custos"; ela sabe que "o fornecedor mandou um
// PDF" ou que "exportei do Bling". E o que cada um aceitava vivia num `title=`
// que só aparece se o mouse parar em cima.
//
// Então a pergunta da tela passou a ser uma que dá para responder — "o que você
// tem?" — e as respostas moram aqui, em texto, testáveis, longe do JSX.
//
// ===========================================================================
// O QUE NÃO É FONTE DE IMPORTAÇÃO
// ===========================================================================
//
// `Frete` NÃO está nesta lista, de propósito. Ele busca no Mercado Livre quem
// paga o frete de cada anúncio e preenche esse campo — não traz produto, não
// lê arquivo, não pede escolha nenhuma. Estava no meio dos importadores só por
// vizinhança visual, e um teste guarda essa ausência: pôr `frete` aqui de volta
// reprova.

/** Como o dado chega. Decide o que a tela faz ao escolher, e o que ela promete. */
export type FormatoDaFonte =
  /** Um arquivo que a pessoa escolhe do computador. */
  | "arquivo"
  /** Uma conexão já existente com o marketplace — não há arquivo. */
  | "conexao";

export interface FonteDeImportacao {
  id: string;
  /** O que ela TEM, na língua dela. Nunca o nome do nosso recorte. */
  titulo: string;
  /** Uma frase. É o que substituiu o `title=` que ninguém lia. */
  frase: string;
  formato: FormatoDaFonte;
  /**
   * O que o arquivo precisa ter, dito antes de escolher — e não depois, num
   * erro. Vazio quando não há arquivo.
   */
  exige: string;
  /**
   * Traz PRODUTO NOVO, ou só completa o que já existe?
   *
   * A distinção governa a ordem e o texto: quem está com a base vazia precisa
   * das três primeiras, e oferecer "só os custos" a quem não tem produto nenhum
   * é oferecer uma porta que não abre para lugar nenhum.
   */
  cria: boolean;
}

/**
 * As fontes, na ordem em que fazem sentido para quem está começando.
 *
 * As que CRIAM produto vêm primeiro. Uma lojista de base vazia que veja "Só os
 * custos" no topo tem todo motivo para clicar nela e não entender por que nada
 * aconteceu.
 */
export const FONTES_DE_IMPORTACAO: readonly FonteDeImportacao[] = [
  {
    id: "catalogo",
    titulo: "Catálogo do meu fornecedor",
    frase: "O PDF que o fornecedor mandou. A IA transcreve os produtos e você confere antes de gravar.",
    formato: "arquivo",
    exige: "PDF, até 500 MB",
    cria: true,
  },
  {
    id: "planilha",
    titulo: "Base do meu ERP",
    frase: "A planilha exportada do Bling, Tiny, Magazord, Linx… O assistente mapeia as colunas.",
    formato: "arquivo",
    exige: "CSV ou Excel",
    cria: true,
  },
  {
    id: "ml",
    titulo: "Meus anúncios do Mercado Livre",
    frase: "Puxa o que já está no ar na sua conta, com fotos, variações e preços.",
    formato: "conexao",
    exige: "",
    cria: true,
  },
  {
    id: "custos",
    titulo: "Só os custos",
    frase: "Para quem já tem os produtos aqui e quer preencher quanto paga em cada um.",
    formato: "arquivo",
    exige: "CSV ou Excel com custo + SKU (ou nome do produto)",
    cria: false,
  },
  {
    id: "peso",
    titulo: "Só peso e medidas",
    frase: "Preenche a embalagem de cada produto — é o que destrava o cálculo de frete.",
    formato: "arquivo",
    exige: "CSV ou Excel com SKU (ou EAN) + peso; altura, largura e comprimento são opcionais",
    cria: false,
  },
];

/** As que trazem produto novo — o que interessa a quem está com a base vazia. */
export function fontesQueCriam(): FonteDeImportacao[] {
  return FONTES_DE_IMPORTACAO.filter((f) => f.cria);
}

/** A fonte de um id, ou null. Id desconhecido não vira a primeira da lista. */
export function fontePorId(id: string): FonteDeImportacao | null {
  return FONTES_DE_IMPORTACAO.find((f) => f.id === id) ?? null;
}
