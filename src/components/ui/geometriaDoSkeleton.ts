// A geometria do esqueleto de carregamento.
//
// POR QUE ISTO É UM MÓDULO PURO E NÃO ESTILO DENTRO DO COMPONENTE
//
// Duas regras aqui são fáceis de quebrar sem ninguém ver, e as duas têm teste:
//
// 1. AS LARGURAS SÃO DETERMINÍSTICAS. A tentação é `Math.random()` para o
//    esqueleto parecer texto de verdade. Num app com renderização no servidor
//    isso produz uma largura no servidor e outra no cliente — divergência de
//    hidratação, que o React reporta como erro e conserta redesenhando. O
//    esqueleto existe para acalmar a tela; um que causa remontagem faz o oposto.
//
// 2. O ESQUELETO PRESERVA A GEOMETRIA DO QUE ESTÁ CHEGANDO. Um spinner central
//    diz "espere"; um esqueleto diz "espere ISTO". Quando o conteúdo chega, ele
//    ocupa aproximadamente o mesmo espaço e a página não pula.
//
// O QUE ESTE MÓDULO NÃO FAZ
//
// Não decide cor, borda nem classe — isso é do componente. Aqui só ficam as
// proporções, que são a parte que tem razão de ser conferida.

/** As formas que a fundação cobre. Não são vinte, e não devem virar vinte. */
export type FormaDoEsqueleto = "linha" | "bloco" | "tabela";

/**
 * A largura de uma linha de texto fantasma, em porcentagem.
 *
 * Um bloco de linhas todas com 100% não parece texto — parece um retângulo. Texto
 * real tem linhas de comprimentos diferentes e a ÚLTIMA curta, porque acaba no
 * meio. As larguras vêm de um ciclo fixo: variam o suficiente para ler como
 * parágrafo e são as mesmas no servidor e no cliente.
 */
export function larguraDaLinha(indice: number, total: number): number {
  if (total <= 0) return 0;
  const ultima = indice === total - 1;
  // Uma última linha curta é o que diz "aqui acaba um parágrafo". Só vale quando
  // há mais de uma: uma linha sozinha com 60% parece um campo, não um texto.
  if (ultima && total > 1) return 62;
  const ciclo = [96, 88, 100, 84, 92];
  return ciclo[indice % ciclo.length];
}

/**
 * As larguras de uma linha da tabela, por coluna.
 *
 * A primeira coluna é a identidade (nome do produto, SKU) e é sempre a mais
 * larga — é assim nas tabelas reais do portal. As demais são estados e números,
 * estreitos e parecidos entre si. Sem essa assimetria o esqueleto de tabela fica
 * igual ao de bloco, e deixa de informar o que está chegando.
 */
export function largurasDaLinhaDaTabela(colunas: number): number[] {
  if (colunas <= 0) return [];
  if (colunas === 1) return [100];
  const identidade = 40;
  const resto = (100 - identidade) / (colunas - 1);
  return [identidade, ...Array.from({ length: colunas - 1 }, () => resto)];
}

/**
 * Quantas linhas fantasma desenhar quando o total real ainda não se sabe.
 *
 * Teto de 8 porque esqueleto longo deixa de acalmar e passa a parecer conteúdo:
 * quem vê trinta linhas cinza acha que a tela carregou errado. E quando já se
 * sabe o total (a tabela tinha 3 linhas e está revalidando), o esqueleto usa o
 * número real — a página não muda de tamanho.
 */
export function linhasParaMostrar(totalConhecido?: number): number {
  const TETO = 8;
  const PADRAO = 5;
  if (totalConhecido === undefined) return PADRAO;
  if (totalConhecido <= 0) return 1;
  return Math.min(totalConhecido, TETO);
}

/**
 * Se a animação deve rodar.
 *
 * O componente resolve isto em CSS (`motion-safe:`), que é o caminho certo
 * porque não depende de JavaScript e acerta desde o primeiro pixel. Esta função
 * existe para o caso em que a decisão precisa ser tomada em código — e para que
 * a regra tenha um teste em vez de viver só numa string de classe.
 */
export function deveAnimar(prefereMenosMovimento: boolean): boolean {
  return !prefereMenosMovimento;
}
