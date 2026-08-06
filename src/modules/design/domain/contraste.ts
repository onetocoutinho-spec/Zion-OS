// Contraste de cor, pela fórmula do WCAG. Puro, sem DOM.
//
// ===========================================================================
// POR QUE ISTO É CÓDIGO E NÃO UM ITEM NUMA LISTA DE REVISÃO
// ===========================================================================
//
// A régua de UI que o dono trouxe (skill `ui-ux-pro-max`) põe acessibilidade
// como prioridade 1, CRITICAL, e a primeira verificação é contraste. Isso
// costuma virar item de checklist — alguém olha, acha que está bom, e segue.
//
// Mas contraste não é opinião: é uma razão entre luminâncias, e portanto é
// MEDÍVEL SEM VER A TELA. Este ambiente não alcança o preview (medido:
// http=000) e não tem banco para um servidor local, então nada aqui pode
// avaliar tipografia ou hierarquia visual. Contraste é a exceção, e é a única
// parte de um estudo de UI que dá para provar num teste.
//
// O que isto pegou na primeira execução, em 05/08/2026: o indicador de foco de
// todo campo do sistema era violet-500 a SESSENTA POR CENTO sobre `#12121c`, o
// que dá 2,34:1 contra o fundo e 1,79:1 contra a borda em repouso — a mudança
// que a pessoa precisa PERCEBER. A régua para indicador não-textual é 3:1.
// Estava abaixo em 22 arquivos, e ninguém veria isso olhando, porque a borda
// MUDA de cor e a mudança parece suficiente para quem já sabe onde clicou.
//
// A opacidade está escrita em palavras acima de propósito. A primeira versão
// deste comentário trazia a classe literal, e o `sed` que consertou os 22
// arquivos consertou o comentário também — deixando este cabeçalho afirmando
// que o defeito era a versão correta. Registro de defeito não pode casar com o
// padrão que o conserto procura.
//
// ===========================================================================
// A RÉGUA CERTA PARA CADA COISA
// ===========================================================================
//
// A skill diz "Contraste 4,5:1". Isso é a régua de TEXTO (WCAG 1.4.3). Para
// indicador de foco, borda de campo e ícone — coisas que não são texto — a
// régua é 3:1 (WCAG 1.4.11). Aplicar 4,5 a tudo reprovaria bordas que estão
// certas, e reprovação em excesso ensina a ignorar o portão.

/** Uma cor em RGB, 0–255. */
export type Rgb = readonly [number, number, number];

/** #rrggbb (com ou sem #) para RGB. Lança em formato que não é esse. */
export function doHex(hex: string): Rgb {
  const s = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(s)) {
    throw new Error(`Cor fora do formato #rrggbb: "${hex}"`);
  }
  return [
    parseInt(s.slice(0, 2), 16),
    parseInt(s.slice(2, 4), 16),
    parseInt(s.slice(4, 6), 16),
  ];
}

/**
 * A cor que se VÊ quando `frente` é desenhada com opacidade sobre `fundo`.
 *
 * Existe porque as classes deste projeto usam alfa (`violet-500/60`,
 * `white/10`), e o contraste do que a pessoa vê não é o da cor pura — é o da
 * composição. Medir a cor pura é o erro que faz um indicador reprovado passar.
 */
export function sobre(frente: Rgb, alfa: number, fundo: Rgb): Rgb {
  const a = Math.min(1, Math.max(0, alfa));
  return [
    a * frente[0] + (1 - a) * fundo[0],
    a * frente[1] + (1 - a) * fundo[1],
    a * frente[2] + (1 - a) * fundo[2],
  ];
}

/** Luminância relativa (WCAG 2.x). */
export function luminancia(cor: Rgb): number {
  const canal = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * canal(cor[0]) + 0.7152 * canal(cor[1]) + 0.0722 * canal(cor[2]);
}

/** A razão de contraste entre duas cores. Sempre ≥ 1, e simétrica. */
export function contraste(a: Rgb, b: Rgb): number {
  const x = luminancia(a);
  const y = luminancia(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Texto normal — WCAG 1.4.3 AA. */
export const MINIMO_TEXTO = 4.5;

/**
 * Indicador não-textual — WCAG 1.4.11 AA.
 *
 * Vale para borda de campo, indicador de foco, ícone que carrega significado e
 * limite de componente. É a régua que o foco deste projeto reprovava.
 */
export const MINIMO_NAO_TEXTO = 3;

/**
 * A menor opacidade de `frente` sobre `fundo` que alcança `minimo`.
 *
 * `null` quando nem opaco alcança — e aí a resposta não é ajustar o alfa, é
 * trocar a cor. Devolver um número nesse caso mandaria alguém subir a opacidade
 * para sempre sem nunca passar.
 */
export function alfaMinimo(
  frente: Rgb,
  fundo: Rgb,
  minimo: number = MINIMO_NAO_TEXTO
): number | null {
  for (let passo = 1; passo <= 100; passo++) {
    if (contraste(sobre(frente, passo / 100, fundo), fundo) >= minimo) return passo / 100;
  }
  return null;
}
