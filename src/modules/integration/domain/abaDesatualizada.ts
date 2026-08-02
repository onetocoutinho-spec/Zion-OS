// A aba está rodando um pacote mais velho que o servidor?
//
// ===========================================================================
// POR QUE ISTO EXISTE
// ===========================================================================
//
// Três vezes em 01–02/08/2026 uma aba aberta continuou rodando o pacote antigo
// depois de um deploy, e o resultado foi lido como FATO:
//
//   · uma importação de 279 anúncios gravou ZERO estado de marketplace, porque
//     a aba não tinha o código que grava. O número foi investigado como se
//     fosse defeito do código novo;
//   · a linha de "campos exigidos que faltam" não apareceu, e nem dava para
//     dizer se era ausência de defeito ou ausência de código.
//
// Uma aba velha não é um erro — é normal, e ninguém recarrega a página do nada.
// O erro é ela ficar CALADA sobre isso enquanto entrega resultado parcial que
// se lê como completo. Mesmo defeito do teto de 500 e do `status` fixo, num
// lugar diferente.
//
// ===========================================================================
// O QUE ESTA FUNÇÃO SE RECUSA A FAZER
// ===========================================================================
//
// Recarregar sozinha. Uma recarga automática no meio de uma importação de 781
// anúncios mataria a operação — e foi trocar de aba, coisa muito menor, que já
// apagou a mensagem de resultado uma vez hoje. Quem decide quando recarregar é
// quem está usando.

export interface Versoes {
  /** A versão compilada DENTRO do pacote que o navegador baixou. */
  doNavegador: string | undefined;
  /** A versão que o servidor respondeu agora. */
  doServidor: string | undefined;
}

/**
 * `true` só quando os dois lados se identificaram E discordam.
 *
 * Faltar qualquer um dos dois significa NÃO SEI, e "não sei" nunca vira aviso:
 * um alarme que dispara sem fato o usuário aprende a ignorar, e aí ele não
 * serve para o dia em que houver fato.
 */
export function abaDesatualizada({ doNavegador, doServidor }: Versoes): boolean {
  const navegador = (doNavegador ?? "").trim();
  const servidor = (doServidor ?? "").trim();
  if (!navegador || !servidor) return false;
  // `dev` dos dois lados é o ambiente local: nunca diverge, nunca avisa.
  return navegador !== servidor;
}

/** A frase, curta e com a ação — o usuário não precisa saber o que é um build. */
export const AVISO_ABA_DESATUALIZADA =
  "Esta aba está com uma versão antiga do sistema. Recarregue a página (Ctrl+Shift+R) antes de continuar — o resultado acima pode estar incompleto.";
