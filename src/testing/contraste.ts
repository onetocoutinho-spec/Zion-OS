// Razão de contraste da WCAG 2.2, para testes que provam cor em vez de opinar.
//
// ===========================================================================
// POR QUE ISTO É CÓDIGO E NÃO UM NÚMERO NO COMENTÁRIO
// ===========================================================================
//
// A correção do `zinc-500` (PR #73) foi medida uma vez, no navegador, e o
// resultado virou um comentário. Comentário não falha quando alguém troca o
// hexadecimal — e a primeira tentativa daquele PR, aliás, foi mergeada com a
// medição verde e a variável errada.
//
// Um teste que RECALCULA a razão a partir do hexadecimal que está no arquivo
// não tem esse buraco: trocar a cor recalcula, e se a cor nova reprovar o
// teste fica vermelho sem ninguém precisar lembrar de medir de novo.
//
// Este módulo é usado só por testes. Nenhum código de aplicação o importa, e
// por isso ele não entra em bundle nenhum.

/** Canal sRGB (0–255) para luminância linear. Fórmula da WCAG. */
function linearizar(canal: number): number {
  const c = canal / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Luminância relativa de um `#rrggbb`. */
export function luminancia(hex: string): number {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  if (!Number.isFinite(n) || hex.replace("#", "").length !== 6) {
    throw new Error(`hexadecimal de 6 dígitos esperado, recebi ${JSON.stringify(hex)}`);
  }
  return (
    0.2126 * linearizar((n >> 16) & 255) +
    0.7152 * linearizar((n >> 8) & 255) +
    0.0722 * linearizar(n & 255)
  );
}

/**
 * Razão de contraste entre duas cores opacas, de 1 a 21.
 *
 * Arredondada em duas casas de propósito: é a precisão em que a WCAG é
 * discutida, e evita que `4.499999` reprove por ponto flutuante.
 */
export function razaoDeContraste(a: string, b: string): number {
  const [maior, menor] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return Number((((maior + 0.05) / (menor + 0.05))).toFixed(2));
}

/**
 * Os quatro fundos opacos do Zion OS, em ordem do mais escuro ao mais claro.
 *
 * O `#12121c` do campo de formulário é o mais claro, e por isso é ele que
 * decide: uma cor de texto que passa nele passa nos outros três. Quem
 * adicionar um quinto fundo precisa vir aqui — é de propósito que a lista
 * seja curta e explícita em vez de varrida do CSS.
 */
export const FUNDOS = {
  canvas: "#08080d",
  sidebar: "#0b0b12",
  cartao: "#0e0e16",
  campo: "#12121c",
} as const;

/** O pior caso: a razão contra o fundo em que a cor menos se destaca. */
export function piorContraste(cor: string): { fundo: string; razao: number } {
  return Object.values(FUNDOS)
    .map((fundo) => ({ fundo, razao: razaoDeContraste(cor, fundo) }))
    .sort((a, b) => a.razao - b.razao)[0];
}
