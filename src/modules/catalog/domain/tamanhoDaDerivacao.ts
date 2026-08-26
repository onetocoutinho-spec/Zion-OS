// O tamanho da derivação, quando a planilha não tem coluna de tamanho.
//
// ===========================================================================
// O QUE A EXPORTAÇÃO DO ERP NÃO TEM — MEDIDO EM 26/08/2026
// ===========================================================================
//
// 28 colunas, e nenhuma se chama `Cor` ou `Tamanho`. Depois de importar, o
// produto pai `2344016` tinha NOVE derivações e:
//
//     9 variantes · 1 cor distinta · 1 tamanho distinto
//
// Ou seja: nove variações que ninguém consegue distinguir. Para o Mercado
// Livre isso é fatal — `COLOR` e `SIZE` são 2 dos 6 atributos OBRIGATÓRIOS da
// categoria de calçado (medido em MLB273770 no mesmo dia).
//
// A informação existe, mas dentro do nome da derivação:
//
//     "SANDALIA MOLEKINHA 2312.260 TURIM FEM (9583 ROSA/SILVER 35)"
//
// ===========================================================================
// O AGRUPADOR É A PROVA DE ONDE O TAMANHO COMEÇA
// ===========================================================================
//
// Cortar "o número do fim" seria palpite, e há derivação cujo tamanho é `37/38`
// e cuja cor tem número no meio (`PRETO 01/CAMEL 1`).
//
// Mas a planilha traz `Código Agrupador`, que junta produto + COR e NÃO inclui
// o tamanho:
//
//     Código Agrupador       "1969985-9583ROSASILVER"
//     Nome da Derivação      "... (9583 ROSA/SILVER 35)"
//
// Comparando só letras e dígitos, o conteúdo entre parênteses COMEÇA com a
// cauda do agrupador. O que sobra é o tamanho — e isso é subtração, não
// adivinhação.
//
// Medido no arquivo real: **7211 das 7224 linhas** casam. As 13 que não casam
// ficam sem tamanho, porque sem prova não há corte.
//
// ===========================================================================
// A COR CONTINUA VAZIA, E É DECISÃO
// ===========================================================================
//
// O agrupador prova onde o tamanho começa, mas não separa CÓDIGO de COR: em
// `9583 ROSA/SILVER` dá para tirar o `9583` inicial; em
// `96781.NP.TAN1080/CAMEL` não existe fronteira. São 41% de um lado e 59% do
// outro.
//
// Usar a cauda do agrupador como cor ("9583ROSASILVER") também não serve: ela
// distingue as cores entre si, mas é chave de máquina, e iria ao ar como a cor
// que o comprador lê.
//
// Então a cor fica vazia e vira pergunta — o mesmo desfecho que
// `resolverObrigatorios` dá a tudo que ninguém mediu. O caminho certo é uma
// exportação do ERP com as colunas separadas.

/** Só letras e dígitos, em maiúsculas: a forma em que as duas colunas se comparam. */
const soAlnum = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** O conteúdo do último parêntese, que é onde o ERP põe código, cor e tamanho. */
function entreParenteses(nome: string): string {
  const m = nome.match(/\(([^)]*)\)\s*$/);
  return m ? m[1].trim() : "";
}

/** A parte do agrupador depois do `-`: id do pai fora, código e cor dentro. */
function caudaDoAgrupador(agrupador: string): string {
  const i = agrupador.indexOf("-");
  return i < 0 ? "" : agrupador.slice(i + 1).trim();
}

/**
 * O tamanho, ou "" quando não há prova.
 *
 * Devolve o trecho ORIGINAL, não o normalizado: um tamanho `37/38` tem barra, e
 * comparar sem pontuação não pode significar devolver sem pontuação.
 */
export function tamanhoDaDerivacao(nomeDerivacao?: string, codigoAgrupador?: string): string {
  const dentro = entreParenteses((nomeDerivacao ?? "").trim());
  const cauda = caudaDoAgrupador((codigoAgrupador ?? "").trim());
  if (!dentro || !cauda) return "";

  const chave = soAlnum(cauda);
  if (!chave || !soAlnum(dentro).startsWith(chave)) return "";

  // Anda no ORIGINAL consumindo tantos alfanuméricos quantos a chave tem. O que
  // vier depois é o tamanho, com a pontuação que ele tiver.
  let consumidos = 0;
  let i = 0;
  for (; i < dentro.length && consumidos < chave.length; i++) {
    if (/[A-Za-z0-9]/.test(dentro[i])) consumidos++;
  }
  return dentro.slice(i).trim().replace(/^[-–—/\\,;.]+/, "").trim();
}
