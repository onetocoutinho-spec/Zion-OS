// D7 — "ainda não vale a tela".
//
// ===========================================================================
// O ACHADO QUE ORIGINOU ISTO
// ===========================================================================
//
// Na exploração, o Draft de cadastro apareceu como superfície própria desde o
// primeiro fato coletado. Com marca e nada mais, o workspace abriria 580px para
// mostrar UM campo preenchido e cinco vazios — e a conversa, que é onde o
// trabalho está acontecendo, encolheria de 720 para 380 para dar lugar a isso.
//
// A tela pioraria em troca de nada. É o inverso do que uma superfície contextual
// deve fazer.
//
// ===========================================================================
// A REGRA
// ===========================================================================
//
// Uma superfície contextual só se justifica quando acrescenta INFORMAÇÃO que a
// conversa não mostra, ou AÇÃO que a conversa não oferece. Enquanto não
// acrescenta nenhuma das duas, a conversa continua dominante.
//
// Note o "ou": não são dois requisitos. Uma tabela de 40 produtos vale a tela só
// por ser informação demais para caber numa fala, mesmo sem botão. Um cartão com
// dois campos e um "Aplicar" vale a tela por causa do botão? Não — esse botão
// cabe na conversa. Por isso `acao` sozinha não basta, e é isso que os limiares
// abaixo codificam.

export interface PrecisaDeTela {
  /**
   * Quantos itens a superfície mostraria — fatos do Draft, linhas da tabela,
   * cartões da fila. É a medida de "informação demais para uma fala".
   */
  itens: number;
  /**
   * Se há ação que a conversa NÃO consegue oferecer: escolher entre muitos,
   * comparar lado a lado, filtrar, selecionar em lote. Um botão de confirmar
   * NÃO conta — cartão de confirmação cabe na conversa e já vive lá.
   */
  acaoQueAConversaNaoOferece: boolean;
  /**
   * Se o conteúdo é uma grade que a conversa distorce: tabela com colunas
   * comparáveis. Prosa e listas curtas não são.
   */
  comparavelLadoALado: boolean;
}

/**
 * O limiar de itens.
 *
 * TRÊS, e não dois: dois fatos são uma frase ("marca Havaianas, modelo Slim"), e
 * a conversa diz isso melhor que uma tela. A partir de três a lista começa a
 * pedir alinhamento vertical para ser lida de relance.
 *
 * O limiar sozinho não decide — ver `valeATela`.
 */
export const MINIMO_DE_ITENS = 3;

/**
 * A resposta de D7.
 *
 * Ordem das perguntas:
 *
 *   1. Comparável lado a lado com pelo menos o mínimo de itens -> vale.
 *      É o caso da tabela e da fila: geometria que a fala não reproduz.
 *   2. Ação que a conversa não oferece E pelo menos o mínimo de itens -> vale.
 *      Selecionar 12 produtos precisa dos 12 na tela.
 *   3. Caso contrário -> NÃO vale, por mais que exista conteúdo.
 *
 * O `itens >= MINIMO` aparece nas duas: é a condição que impede o Draft de abrir
 * a tela com marca e nada mais, mesmo tendo ação.
 */
export function valeATela(c: PrecisaDeTela): boolean {
  if (c.itens < MINIMO_DE_ITENS) return false;
  return c.comparavelLadoALado || c.acaoQueAConversaNaoOferece;
}

/**
 * O que a conversa diz quando ainda não vale a tela.
 *
 * Devolve `null` quando vale — para que a superfície não tenha o que mostrar em
 * vez de mostrar uma explicação vazia.
 */
export function porQueAindaNaoVale(c: PrecisaDeTela): string | null {
  if (valeATela(c)) return null;
  if (c.itens === 0) return "Ainda não há nada para mostrar aqui.";
  if (c.itens < MINIMO_DE_ITENS) {
    return "Ainda são poucos dados — a conversa mostra tudo o que sabemos até agora.";
  }
  return "Isto cabe na conversa: não há o que comparar nem o que escolher em lote.";
}
