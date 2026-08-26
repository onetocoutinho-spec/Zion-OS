// Qual lista de obrigatórios vale para ESTE produto — e de onde ela veio.
//
// ===========================================================================
// O DEFEITO QUE ISTO FECHA — MEDIDO EM 25/08/2026 (AUD-007, INC-011)
// ===========================================================================
//
// O de-calçar de 05/08 tirou os obrigatórios de dentro de
// `resolverObrigatorios` e os transformou em parâmetro. Ficou honesto e ficou
// incompleto: os caminhos passavam `OBRIGATORIOS_CALCADO` à mão porque ninguém
// descobria a categoria. O contrato de `OpcoesDaPreparacao.obrigatorios` já
// dizia "quem sabe passa" — e ninguém sabia.
//
// Medido na conta real: 792 anúncios em SEIS categorias, e o retrato de calçado
// vale para uma.
//
//     MLB273770   674   certo
//     MLB23332     94   exige 5, e FOOTWEAR_TYPE NÃO EXISTE nesta categoria
//     MLB7022       8   exige 2: marca e modelo
//     MLB1400       8   FOOTWEAR_TYPE é `string`, não lista fechada
//     MLB275574     7   exige 5
//     MLB108791     1   exige 7, com SOCKS_TYPE e LENGTH_TYPE
//
// São 118 anúncios (15%) cobrados pela lista errada. Em MLB23332 a exigência de
// tipo de calçado vira pendência que não existe — e `avaliarPreparacao` marca a
// identidade como BLOQUEADA, então o produto não gera anúncio por causa de um
// campo que o marketplace não pede.
//
// ===========================================================================
// A REGRA, E O QUE ELA SE RECUSA A FAZER
// ===========================================================================
//
// Quem sabe a categoria e tem a lista dela, usa a lista. Quem não sabe continua
// com calçado — EXATAMENTE o comportamento de hoje, porque 674 dos 792 anúncios
// estão nessa categoria e nenhum deles pode passar a exigir algo diferente.
//
// **Lista vazia não é "não exige nada".** `atributosObrigatorios` devolve `[]`
// quando o ML não responde — é a falha aberta que ele documenta: sem
// confirmação, não se afirma exigência nenhuma. Aceitar esse `[]` como resposta
// faria a categoria muda liberar publicação sem ficha, que é pior do que pedir
// um campo a mais. Vazio cai no palpite.
//
// Nada aqui BLOQUEIA por não saber. Categoria desconhecida não vira parede
// nova: ela mantém a parede que já existia.

import { OBRIGATORIOS_CALCADO, type ExigenciaDaCategoria } from "./atributosDoMarketplace.ts";

/**
 * De onde saiu a lista que está sendo cobrada.
 *
 * Existe para o chamador poder DIZER isso — "o Mercado Livre exige" e "a gente
 * supõe que exige" não são a mesma frase, e a segunda foi cobrada como se fosse
 * a primeira em 118 anúncios.
 */
export type ProcedenciaDosObrigatorios = "categoria" | "palpite";

export interface ObrigatoriosEscolhidos {
  exigencias: readonly ExigenciaDaCategoria[];
  procedencia: ProcedenciaDosObrigatorios;
  /** A categoria que sustentou a lista. `null` quando é palpite. */
  categoria: string | null;
}

/**
 * A lista que vale para este produto.
 *
 * `daCategoria` é o que `atributosObrigatorios(categoria)` devolveu — ou nada,
 * quando o chamador não foi buscar. A rede fica FORA daqui: esta decisão é
 * determinística, e "por que esse produto foi cobrado disto?" precisa ter a
 * mesma resposta toda vez.
 */
export function obrigatoriosDoProduto(
  categoria: string | null | undefined,
  daCategoria?: readonly ExigenciaDaCategoria[] | null
): ObrigatoriosEscolhidos {
  const id = (categoria ?? "").trim();
  if (id && daCategoria && daCategoria.length > 0) {
    return { exigencias: daCategoria, procedencia: "categoria", categoria: id };
  }
  return { exigencias: OBRIGATORIOS_CALCADO, procedencia: "palpite", categoria: null };
}
