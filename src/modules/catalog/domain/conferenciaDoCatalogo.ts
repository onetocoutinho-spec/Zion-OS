// O que a lojista decide antes de gravar o que veio do PDF. PURO.
//
// ===========================================================================
// POR QUE A CONFERÊNCIA É DESMARCAR, E NÃO CORRIGIR
// ===========================================================================
//
// O modelo transcreve 90 páginas. O erro que ele comete não é escrever um nome
// torto — é transformar em PRODUTO aquilo que era um cabeçalho de seção, um
// índice ou uma legenda de foto. `linhasComOrigem` já derruba o que não tem
// nome, mas "LINHA QUARTO" tem nome e parece um produto.
//
// Corrigir cada campo aqui seria refazer a tela de cadastro dentro da tela de
// importação. O que resolve é bem menor: a lojista OLHA a lista, tira o que não
// é produto, e grava o resto — que depois edita no cadastro, onde já se edita.
//
// Por isso o estado desta tela é um conjunto de DESCARTADOS, e não de
// selecionados: o padrão é importar tudo, porque o caso comum é o modelo ter
// acertado. Um padrão invertido faria a lojista marcar 60 caixas para fazer o
// que ela já queria.
//
// ===========================================================================
// O ÍNDICE É A IDENTIDADE, E ISSO É DELIBERADO
// ===========================================================================
//
// Não há id: estas linhas nunca foram gravadas, então não existe chave. Dois
// produtos podem ter o mesmo nome e o mesmo SKU gerado (duas versões do mesmo
// item numa página mal lida), e desmarcar por nome tiraria os dois. A posição
// na lista é a única coisa que distingue um do outro — e ela é estável porque
// a lista não é reordenada nem refiltrada entre a leitura e a gravação.

import type { LinhaProduto } from "../../../lib/services/importacaoProdutos";
import type { LinhaComOrigem } from "./produtosDoCatalogo";

export interface ResumoDaSelecao {
  produtos: number;
  variacoes: number;
  descartados: number;
}

/**
 * As linhas que vão ser gravadas, na ordem em que foram lidas.
 *
 * Índice fora da lista em `descartados` é ignorado em silêncio: ele só aparece
 * se a lista mudou por baixo, e nesse caso derrubar a importação inteira seria
 * pior que gravar o que sobrou.
 */
export function linhasParaImportar(
  itens: readonly LinhaComOrigem[],
  descartados: ReadonlySet<number>
): LinhaProduto[] {
  return itens.filter((_, i) => !descartados.has(i)).map((x) => x.linha);
}

/** O que o botão diz que vai acontecer. Conta o que SOBROU, não o que foi lido. */
export function resumoDaSelecao(
  itens: readonly LinhaComOrigem[],
  descartados: ReadonlySet<number>
): ResumoDaSelecao {
  const restantes = itens.filter((_, i) => !descartados.has(i));
  return {
    produtos: restantes.length,
    variacoes: restantes.reduce((s, x) => s + (x.linha.variacoes?.length ?? 0), 0),
    // Contado sobre os índices que EXISTEM: um descartado que sobrou de uma
    // lista anterior não pode inflar o número que a lojista lê.
    descartados: itens.length - restantes.length,
  };
}

/** Marca/desmarca um índice, devolvendo um conjunto novo (nunca mutando). */
export function alternarDescarte(
  descartados: ReadonlySet<number>,
  indice: number
): Set<number> {
  const novo = new Set(descartados);
  if (novo.has(indice)) novo.delete(indice);
  else novo.add(indice);
  return novo;
}

/**
 * O tamanho de um arquivo, para quem vai esperar por ele.
 *
 * Existe porque o primeiro catálogo tem 272,6 MB e o número decide se a pessoa
 * entende a espera ou acha que travou. Base 1024 com rótulo MB é a convenção que
 * o sistema operacional dela mostra — bater com o que ela já viu importa mais
 * que a precisão do prefixo.
 */
export function tamanhoLegivel(bytes: number): string {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  const mb = n / (1024 * 1024);
  if (mb < 1024) return `${(Math.round(mb * 10) / 10).toString().replace(".", ",")} MB`;
  return `${(Math.round((mb / 1024) * 100) / 100).toString().replace(".", ",")} GB`;
}

/**
 * Um número de tokens como gente lê.
 *
 * Tokens, e NÃO reais. O projeto inteiro mede uso em tokens e nunca converteu
 * para dinheiro (ver `UsoDeTokens`), porque a tabela de preço é externa, muda
 * sem avisar e um valor em R$ congelado no código viraria exatamente a
 * suposição-vestida-de-fato que este repositório persegue. Quem sabe o preço do
 * dia é quem paga a fatura.
 */
export function tokensLegiveis(tokens: number): string {
  const n = Number(tokens);
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n < 1000) return String(Math.round(n));
  return `${(Math.round((n / 1000) * 10) / 10).toString().replace(".", ",")} mil`;
}
