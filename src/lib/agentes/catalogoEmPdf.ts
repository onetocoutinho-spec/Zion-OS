// O agente que lê um catálogo em PDF e devolve produtos — prompt e schema.
//
// ===========================================================================
// O QUE ESTE AGENTE É, E O QUE ELE NÃO É
// ===========================================================================
//
// Ele TRANSCREVE. Não pesquisa, não completa, não melhora. A diferença importa
// porque este projeto tem um agente que faz o contrário de propósito (o A0,
// "Pesquisador/Enriquecedor", que preenche lacuna pesquisando fonte externa), e
// misturar os dois aqui destruiria a única coisa que torna o PDF valioso:
//
//   o que sai daqui é o que o FORNECEDOR escreveu, não o que o modelo achou.
//
// É essa a diferença entre uma ficha com origem e uma afirmação ao comprador —
// e afirmação errada é onde o Mercado Livre pune esta conta (110 infrações
// DOMAIN, a mais recente de 03/08/2026). Enriquecer é legítimo; é etapa
// seguinte, com a lojista sabendo que é enriquecimento.
//
// ===========================================================================
// A PÁGINA VIAJA JUNTO, E POR QUE NÃO É CITAÇÃO DE VERDADE
// ===========================================================================
//
// A API tem citações nativas: `citations: {enabled:true}` devolve o trecho e a
// página com prova, verificável. Elas são INCOMPATÍVEIS com saída estruturada —
// a combinação é recusada com 400 — e toda a arquitetura de agentes daqui
// depende de schema.
//
// Então `paginaOrigem` é o modelo DECLARANDO a página, não a API PROVANDO.
// Registrado para ninguém confundir depois: campo declarado é afirmação do
// modelo; citação é prova. Para o uso atual — a lojista abrir a página e
// conferir — declarar basta, e um número errado aparece na primeira conferência.

import type { ChamadaIA } from "./provedorIA";

export const SYSTEM_CATALOGO_PDF = `Você lê CATÁLOGOS DE FORNECEDOR e transcreve os produtos que estão neles.

O QUE VOCÊ FAZ: transcrever. O que sai é o que o catálogo diz — nada além.

O QUE VOCÊ NÃO FAZ, em nenhuma hipótese:
- NÃO invente produto que não está no documento.
- NÃO complete campo com conhecimento seu sobre a marca, o material ou a categoria. Campo que a página não traz fica VAZIO. Vazio é uma resposta correta; preenchido por dedução é uma afirmação que alguém vai publicar como verdade.
- NÃO transcreva preço. O número de um catálogo de fornecedor não é o custo da lojista nem o preço de venda dela, e herdá-lo decide errado quanto a loja lucra. Preço é a lojista quem preenche.
- NÃO invente SKU, código ou EAN. Um código plausível e falso vira pedido que ninguém sabe despachar.

O QUE É UM PRODUTO: um item que o fornecedor vende. Cabeçalho de seção, índice, sumário, página de capa, dados da empresa e texto institucional NÃO são produtos — ignore.

VARIAÇÕES: quando a página lista cores ou medidas/tamanhos do MESMO item, elas são variações dele, não produtos separados. Quando são itens distintos, são produtos separados. Na dúvida entre os dois, prefira produtos separados: juntar errado esconde um item, separar errado só dá trabalho de mesclar.

MATERIAL: o que a página declarar ("100% Madeira Maciça de Angelim"). Vazio se não disser.

DIMENSÕES: as medidas da peça, em CENTÍMETROS, em "dimensoes". Elas costumam estar num DESENHO TÉCNICO com setas — leia os números do desenho. Converta se a página usar outra unidade (mm → cm). Informe só o que a página mostra: uma medida que você não viu fica de fora, e não se deduz altura a partir de largura.
NÃO confunda com medidas de PARTE do produto: "pés com 8 cm de largura" e "sarrafo de 45x45 mm" descrevem componentes, não a peça montada — esses vão na descrição, não em "dimensoes".

DESCRIÇÃO: o resto do que a página diz sobre o produto — acabamento, montagem, capacidade, detalhes de componente. Texto da página, não seu.

PÁGINA: informe em "paginaOrigem" o número da página do PDF onde leu cada produto. É por ele que a lojista confere.

Responda em português do Brasil.`;

/** O schema da extração. Espelha `ProdutoLidoDoCatalogo` do domínio. */
export const ESQUEMA_CATALOGO_PDF: Record<string, unknown> = {
  type: "object",
  properties: {
    produtos: {
      type: "array",
      description: "Os produtos encontrados no documento, na ordem em que aparecem.",
      items: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome do produto como o catálogo o chama." },
          marca: { type: "string", description: "Vazio se a página não disser." },
          modelo: { type: "string", description: "Código/modelo do fornecedor. Vazio se não houver." },
          material: { type: "string", description: "Material declarado na página. Vazio se não disser." },
          dimensoes: {
            type: "object",
            description:
              "Medidas da PEÇA MONTADA, em centímetros, geralmente lidas do desenho técnico. Omita o campo que a página não mostrar — não deduza.",
            // `null` em vez de campo ausente: em saída estruturada estrita, o
            // que fica fora de `required` é terreno incerto, e "a página não
            // mostrou" precisa ser dizível sem ambiguidade. `null` diz isso;
            // zero diria "mede zero centímetros", que é outra coisa — a mesma
            // distinção que fez `margem` ser null neste projeto.
            properties: {
              alturaCm: { type: ["number", "null"] },
              larguraCm: { type: ["number", "null"] },
              comprimentoCm: { type: ["number", "null"] },
              pesoKg: { type: ["number", "null"] },
            },
            required: ["alturaCm", "larguraCm", "comprimentoCm", "pesoKg"],
            additionalProperties: false,
          },
          paginaOrigem: { type: "integer", description: "Página do PDF onde este produto foi lido." },
          descricao: {
            type: "string",
            description:
              "O que a página diz sobre o produto (material, dimensões, montagem…), copiado dela.",
          },
          variacoes: {
            type: "array",
            description: "Cores e/ou medidas do MESMO item. Vazio quando o item é único.",
            items: {
              type: "object",
              properties: {
                cor: { type: "string" },
                tamanho: { type: "string", description: "Tamanho, medida ou dimensão da variação." },
              },
              required: ["cor", "tamanho"],
              additionalProperties: false,
            },
          },
        },
        required: ["nome", "marca", "modelo", "material", "dimensoes", "paginaOrigem", "descricao", "variacoes"],
        additionalProperties: false,
      },
    },
  },
  required: ["produtos"],
  additionalProperties: false,
};

/**
 * A chamada pronta, dado um PDF já enviado à Files API.
 *
 * `maxTokens` alto porque a saída é proporcional ao catálogo: 90 páginas de
 * móveis produzem muito mais JSON que uma resposta de conversa. Cortar aqui
 * truncaria a lista no meio, e uma lista truncada PARECE completa.
 */
export function chamadaDoCatalogo(fileId: string, instrucao?: string): ChamadaIA {
  return {
    system: SYSTEM_CATALOGO_PDF,
    anexos: [{ tipo: "pdf-arquivo", fileId }],
    mensagem:
      instrucao?.trim() ||
      "Transcreva os produtos deste catálogo. Lembre: campo que a página não traz fica vazio, e preço não se transcreve.",
    schema: ESQUEMA_CATALOGO_PDF,
    maxTokens: 64000,
  };
}
