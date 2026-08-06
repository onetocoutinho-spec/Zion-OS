// A aritmética do foco preso — separada da pintura, como `geometriaDoSkeleton`.
//
// ===========================================================================
// POR QUE ESTE ARQUIVO EXISTE SEPARADO DO HOOK
// ===========================================================================
//
// `npm test` roda só `src/**/*.test.ts`: os arquivos `.test.tsx` são
// type-checked e NUNCA executados. Um teste que precise montar componente
// nasceria morto. Então a regra que dá para errar — quem recebe o foco quando
// o Tab chega na borda — mora aqui, em lógica pura, com teste que roda.
//
// O hook (`useDialogo.ts`) fica com o que só o navegador sabe fazer: achar os
// focáveis, ouvir tecla, devolver o foco.

/**
 * O que conta como parada de Tab dentro de um diálogo.
 *
 * `[tabindex="-1"]` fica de fora de propósito: é justamente a marca de "posso
 * receber foco por programa, mas não sou parada do Tab" — e é o que a caixa do
 * diálogo usa para poder receber o foco inicial sem virar uma parada a mais.
 */
export const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Para onde o Tab deve ir — ou `null` para deixar o navegador seguir.
 *
 * @param total   quantos focáveis existem dentro do diálogo
 * @param atual   índice do que está focado; **-1** quando o foco escapou
 * @param paraTras Shift+Tab
 *
 * DEVOLVER `null` NO MEIO É O PONTO DESTA FUNÇÃO, e não uma economia.
 *
 * A tentação é calcular sempre `(atual + 1) % total` e mandar o foco na mão.
 * Isso reimplementa o Tab do navegador — e o navegador faz coisas que esta
 * lista não sabe: um grupo de rádios é UMA parada e anda com as setas, um
 * `contenteditable` tem regras próprias, e a ordem visual pode não ser a ordem
 * do DOM. Reimplementar tudo isso quebra em silêncio.
 *
 * Então só intervimos nas DUAS bordas, que é onde o navegador levaria o foco
 * para fora do diálogo. No meio, quem manda continua sendo ele.
 */
export function proximoIndiceDoFoco(
  total: number,
  atual: number,
  paraTras: boolean
): number | null {
  // Diálogo sem nada focável: não há para onde mandar. O hook trata este caso
  // pondo o foco na própria caixa.
  if (total <= 0) return null;

  // O foco escapou (clique no fundo, elemento removido, `autofocus` de fora).
  // Puxa de volta pela ponta de onde o Tab estaria vindo.
  if (atual < 0) return paraTras ? total - 1 : 0;

  if (paraTras && atual === 0) return total - 1;
  if (!paraTras && atual === total - 1) return 0;

  return null;
}
