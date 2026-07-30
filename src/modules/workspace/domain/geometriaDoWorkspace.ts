// D1–D5: a geometria do Adaptive Split Workspace, derivada do shell REAL.
//
// ===========================================================================
// O QUE FOI MEDIDO — e a correção que a medição impôs
// ===========================================================================
//
// De `ClientPortalShell.tsx`:
//
//   aside     hidden lg:block w-60 shrink-0 fixed   -> 240px, e SÓ a partir de lg
//   conteúdo  flex-1 lg:pl-60                       -> recuado 240px em lg+
//   main      px-4 sm:px-6 lg:px-8                  -> 16 / 24 / 32px por lado
//   interno   mx-auto max-w-5xl                     -> TETO DE 1024px
//
// O `max-w-5xl` é o achado que muda tudo, e é o que a exploração do Higgsfield
// não tinha como ver. A largura útil NÃO é a da janela:
//
//   janela 1024 (lg)   1024 - 240 - 64 =  720px
//   janela 1280 (xl)   1280 - 240 - 64 =  976px
//   janela 1328+       teto do max-w-5xl = 1024px
//   janela 1536 (2xl)  teto do max-w-5xl = 1024px  <- não cresce mais
//
// CORREÇÃO A UM NÚMERO MEU: eu havia calculado "660px de workspace a 1280" na
// falsificação da arquitetura C. Está errado — ignorei o `max-w-5xl` e o
// `lg:px-8`. A 1280 sobram 976px úteis, e um chat de 380 deixa 580 para o
// workspace, não 660. A conclusão da falsificação (B e C dão a mesma largura de
// tabela) sobrevive; o número não.
//
// ===========================================================================
// AS DUAS LARGURAS MÍNIMAS, e de onde vêm
// ===========================================================================
//
// CONVERSA >= 360px. Abaixo disso os cartões que ela hospeda — lote, pendências,
// pricing, preparação — quebram: são grades de rótulo + valor, e a 320px o valor
// desce para a linha seguinte em todos eles. A prosa caberia; os cartões não.
//
// WORKSPACE >= 420px. A superfície densa é a tabela, e ela precisa da coluna de
// identidade (~170px para "Chinelo Havaianas Slim Square Feminino") mais três
// colunas de estado (~70px) mais respiro. Abaixo de 420 a identidade trunca no
// meio do nome, e uma tabela cuja primeira coluna não identifica não serve para
// escolher nada — que é a única coisa que se faz nela.

/** Tailwind default. Não inventados: são os que o projeto já usa. */
export const BREAKPOINTS = { sm: 640, md: 768, lg: 1024, xl: 1280, xxl: 1536 } as const;

export const SIDEBAR_PX = 240;
export const TETO_DO_CONTEUDO_PX = 1024;
export const GAP_DO_SPLIT_PX = 16;

export const MINIMO_DA_CONVERSA_PX = 360;
export const MINIMO_DO_WORKSPACE_PX = 420;

/** D1, no modo sem workspace: a conversa não se esticа até 1024. */
export const CONVERSA_SOZINHA_MAX_PX = 720;
/** D1, no split: fixa. Ver `larguraDaConversa`. */
export const CONVERSA_NO_SPLIT_PX = 380;

/**
 * O padding horizontal total do `main`, pelos breakpoints reais.
 */
export function paddingHorizontalPx(janela: number): number {
  if (janela >= BREAKPOINTS.lg) return 64; // lg:px-8
  if (janela >= BREAKPOINTS.sm) return 48; // sm:px-6
  return 32; // px-4
}

/**
 * A largura útil de conteúdo — o número que todas as outras decisões usam.
 *
 * A sidebar só desconta a partir de `lg`: abaixo dela é gaveta sobreposta, e o
 * conteúdo ocupa a janela inteira.
 */
export function larguraUtilPx(janela: number): number {
  const semSidebar = janela >= BREAKPOINTS.lg ? janela - SIDEBAR_PX : janela;
  const disponivel = semSidebar - paddingHorizontalPx(janela);
  return Math.max(0, Math.min(TETO_DO_CONTEUDO_PX, disponivel));
}

/**
 * O que o split precisa de largura útil, de fato.
 *
 * Note que a conta usa `CONVERSA_NO_SPLIT_PX` (380) e NÃO
 * `MINIMO_DA_CONVERSA_PX` (360). A primeira versão somava o mínimo teórico, e o
 * próprio teste pegou: numa janela de 844px a conta dizia "cabe" e entregava
 * 400px de workspace — abaixo do mínimo dele. O mínimo da conversa é o piso que
 * justificou ESCOLHER 380; o que o split consome é 380.
 */
export const UTIL_MINIMO_PARA_SPLIT =
  CONVERSA_NO_SPLIT_PX + GAP_DO_SPLIT_PX + MINIMO_DO_WORKSPACE_PX;

/**
 * D4 — o breakpoint em que o split deixa de existir.
 *
 * Duas condições, e as duas são necessárias.
 *
 * ARITMÉTICA: 380 (conversa) + 16 (gap) + 420 (workspace) = 816px úteis.
 *
 *   janela 1024 (lg)  ->  720 úteis  -> NÃO CABE
 *   janela 1280 (xl)  ->  976 úteis  -> cabe
 *
 * BREAKPOINT: `janela >= xl`, e não só a aritmética. Sem esta condição uma
 * janela de 900px passaria — porque abaixo de `lg` a sidebar é gaveta e não
 * desconta os 240px, então "sobra" largura. Mas 900px é tablet, e tablet é
 * justamente o que esta vertical NÃO resolve (ver a decisão de mobile). Um split
 * que aparece a 900 e desaparece a 1024, para reaparecer a 1280, seria três
 * layouts diferentes em duas polegadas.
 *
 * Entre `lg` e `xl` o portal tem sidebar e não tem split — faixa real de telas:
 * 1366 entra por cima, 1280 por baixo.
 */
export function comportaSplit(janela: number): boolean {
  if (janela < BREAKPOINTS.xl) return false;
  return larguraUtilPx(janela) >= UTIL_MINIMO_PARA_SPLIT;
}

/** O breakpoint nominal do split, para escrever a classe no componente. */
export const BREAKPOINT_DO_SPLIT = BREAKPOINTS.xl;

/**
 * D1 — largura e comportamento da conversa.
 *
 * SOZINHA a conversa é limitada e centrada. Deixá-la ocupar 1024px pareceria
 * aproveitar a tela e produziria linha de 140 caracteres, que o olho perde no
 * retorno. O teto é 720 porque é o que os cartões dela pedem — não a prosa.
 *
 * NO SPLIT ela é FIXA em 380. Fixa e não proporcional porque conversa não
 * melhora com largura depois de um ponto, e tabela melhora sempre: todo pixel
 * acima do necessário deve ir para o lado que os usa.
 */
export function larguraDaConversa(
  janela: number,
  comWorkspace: boolean
): { px: number; centrada: boolean; fixa: boolean } {
  const util = larguraUtilPx(janela);
  if (!comWorkspace || !comportaSplit(janela)) {
    return { px: Math.min(CONVERSA_SOZINHA_MAX_PX, util), centrada: true, fixa: false };
  }
  return { px: CONVERSA_NO_SPLIT_PX, centrada: false, fixa: true };
}

/**
 * D2 — largura e comportamento do workspace.
 *
 * Ele absorve toda a variação: é o lado que se beneficia de espaço. `null`
 * significa "não há split nesta janela" — e nesse caso o workspace não encolhe,
 * ele muda de forma (ver D6/`apresentacaoDoWorkspace`).
 *
 *   janela 1280  ->  976 - 380 - 16 = 580px
 *   janela 1328+ -> 1024 - 380 - 16 = 628px
 */
export function larguraDoWorkspace(janela: number): number | null {
  if (!comportaSplit(janela)) return null;
  return larguraUtilPx(janela) - CONVERSA_NO_SPLIT_PX - GAP_DO_SPLIT_PX;
}

/**
 * D3 — comportamento da sidebar.
 *
 * NÃO MUDA. É a decisão mais importante desta lista e a mais fácil de errar: a
 * tentação é colapsar a sidebar no split para ganhar 240px. Isso trocaria uma
 * superfície de NAVEGAÇÃO estável por 240px de superfície de TRABALHO — e faria
 * a barra de navegação aparecer e desaparecer conforme o workspace, que é
 * exatamente o tipo de troca automática que a regra aprovada proíbe.
 *
 * A sidebar já colapsa por conta própria abaixo de `lg`, e isso é do shell.
 */
export function comportamentoDaSidebar(
  janela: number
): { forma: "fixa" | "gaveta"; px: number; colapsaNoSplit: false } {
  return janela >= BREAKPOINTS.lg
    ? { forma: "fixa", px: SIDEBAR_PX, colapsaNoSplit: false }
    : { forma: "gaveta", px: 256, colapsaNoSplit: false };
}

/**
 * D5 — drill-down.
 *
 * Abrir o detalhe de um produto a partir da tabela NÃO abre uma terceira coluna
 * e NÃO troca o modo: substitui o conteúdo do workspace, empilhando, com volta.
 *
 * Três colunas seriam 380 + 420 + 420 = 1220 úteis, e o teto é 1024. Não cabe em
 * nenhuma janela, em nenhum monitor — o `max-w-5xl` fecha essa porta antes de a
 * discussão começar.
 *
 * A profundidade é 1 por decisão, não por limitação: detalhe do detalhe é onde
 * se perde de onde se veio, e a conversa ao lado é a trilha de volta natural.
 */
export const DRILL_DOWN = {
  forma: "substitui-o-workspace",
  profundidadeMaxima: 1,
  preservaAConversa: true,
  temVolta: true,
} as const;

/**
 * Quantas colunas a tabela do workspace comporta.
 *
 * Serve ao esqueleto (que precisa saber a geometria antes do dado) e à tabela
 * densa. Identidade sempre existe; as demais entram conforme sobra espaço.
 */
export function colunasDaTabelaNoWorkspace(janela: number): number {
  const w = larguraDoWorkspace(janela);
  if (w === null) return 4; // largura cheia, fora do split
  const IDENTIDADE = 170;
  const COLUNA = 70;
  return 1 + Math.max(1, Math.floor((w - IDENTIDADE) / COLUNA));
}
