// Quando o campo de código traz uma PALAVRA — e a palavra é um recado.
//
// ===========================================================================
// O QUE ACONTECEU, MEDIDO EM 27/08/2026
// ===========================================================================
//
// O catálogo da lojista tem 1003 produtos, e 22 deles têm isto no lugar do SKU
// e do Código do ERP, os dois campos com o mesmo valor:
//
//     inativoo   iinnattivo   inatt      inativo7    inativ
//     inativado  innattivoo   iinativoo  inattivvo   iiinativo
//     INAATIVO   iinnativo    inativoooo INATIVVO    iinnaattivo
//     iinativo   inaattivo    inatiivo   inativos    inativva
//     inattivoo  innativo                            PRESENTE
//
// Ninguém digitou isso vinte e duas vezes por acidente. É um RECADO: alguém no
// ERP escreveu "inativo" no campo do código para marcar que aquele produto saiu
// de linha, e escreveu com uma letra a mais a cada vez porque o ERP não deixa
// dois produtos terem o mesmo código. A grafia errada não é descuido — é o jeito
// de contornar a restrição de unicidade.
//
// O importador leu tudo como SKU. Os 22 viraram produtos normais: entraram na
// contagem do catálogo, na lista de "faltam fotos", e 19 deles RECEBERAM foto —
// trabalho gasto em produto que não se vende.
//
// ===========================================================================
// POR QUE ISTO AVISA E NÃO CONSERTA
// ===========================================================================
//
// "inativo" no campo do código diz que a linha é um marcador, mas NÃO diz o que
// fazer com ela. Pular na importação seria decidir por conta própria que aquele
// produto não interessa — e o estoque, o preço e o histórico dele continuam
// existindo. Adivinhar um código também não: não há de onde tirar.
//
// Então é aviso, no mesmo lugar de `gradeAchatada` e `pesoImplausivel`: a
// importação segue, o número aparece antes de confirmar, e quem manda decide.
// "Avisar, não travar" — e o inverso disto é o alçapão: importar em verde e
// descobrir semanas depois que 22 produtos do catálogo não existem.
//
// ===========================================================================
// O QUE CONTA COMO PALAVRA — E POR QUE A AUSÊNCIA DE DÍGITO NÃO BASTA
// ===========================================================================
//
// Código costuma ter dígito. "7208.101", "MF9184", "2588100", "010.012" — todos
// têm. Mas "costuma" não é "sempre", e a primeira versão desta regra usava só
// isso: sem dígito = palavra.
//
// ERRADO, e o próprio repositório tem o contraexemplo. O catálogo de móveis dos
// testes usa SKU sem dígito nenhum:
//
//     CAT-CAMA-BELLA-CASAL-MOGNO
//     CAT-JOGO-DE-MESA-DOBRAVEL
//
// Numa loja assim, TODOS os produtos seriam marcados. E como
// `scripts/apagarProdutosMarcadores.mjs` usa esta mesma classificação para
// decidir o que apagar, o catálogo inteiro sairia — com variantes, fotos e
// anúncios. Uma regra de aviso virou uma regra de exclusão, e a de exclusão
// precisa de mais.
//
// O QUE DISCRIMINA É SER EXCEÇÃO NO PRÓPRIO CATÁLOGO. Medido em 27/08/2026 na
// base real: 983 de 983 SKUs têm dígito — os 22 marcadores eram a exceção de um
// catálogo cuja convenção é numérica. Num catálogo de móvel a proporção é a
// oposta, e ali "sem dígito" é a convenção, não o desvio.
//
// (O sinal óbvio não serve: `sku === cod_erp` vale em 981 dos 983, marcadores
// e produtos normais igualmente. Foi medido antes de ser descartado.)
//
// Por isso `ehPalavraNoLugarDoCodigo` responde sobre UM VALOR e não decide
// nada sozinha; quem decide é `avisoDeCodigoQueEPalavra`, que vê a lista
// inteira. A distinção está nos nomes de propósito.
//
// A regra não tenta reconhecer a palavra "inativo". Reconhecer palavras seria
// perseguir grafias para sempre — foram 22 variações num arquivo só. E o aviso
// vale igual para "PRESENTE", "brinde", "kit", ou o que o próximo ERP inventar.

/** Um produto lido do arquivo, do jeito que a importação o monta. */
export interface LinhaComCodigo {
  nome: string;
  sku: string;
  codErp?: string;
}

export interface AvisoDeCodigo {
  /** Quantas linhas trazem palavra no lugar do código. */
  linhas: number;
  /** As palavras distintas encontradas, em ordem de frequência. */
  palavras: string[];
  /** Alguns nomes de produto afetados, para a pessoa reconhecer o caso. */
  exemplos: string[];
  /** A frase da tela: diz a consequência, não o fato. */
  texto: string;
}

/**
 * Sem nenhum dígito e com pelo menos duas letras: PARECE palavra.
 *
 * Responde sobre um valor isolado, e por isso NÃO BASTA para decidir: num
 * catálogo de móvel todo SKU passa neste teste. Quem decide é
 * `avisoDeCodigoQueEPalavra`, que compara com o resto da lista.
 */
export function ehPalavraNoLugarDoCodigo(valor: string | undefined | null): boolean {
  const v = String(valor ?? "").trim();
  if (v.length < 2) return false;
  if (/[0-9]/.test(v)) return false;
  return /[a-zA-ZÀ-ÿ]{2,}/.test(v);
}

const MAX_PALAVRAS = 6;
const MAX_EXEMPLOS = 3;

/**
 * Quanto do catálogo precisa usar dígito para que "sem dígito" seja desvio.
 *
 * Abaixo disto, códigos sem dígito são a CONVENÇÃO daquele ERP e não há o que
 * avisar. Medido: a base real tem 100% com dígito; o catálogo de móvel dos
 * testes tem 0%. Os dois ficam longe da linha, que é o que se quer de um corte
 * — ele separa dois mundos, não corta um deles ao meio.
 */
const CONVENCAO_NUMERICA = 0.8;

/**
 * O arquivo traz palavra onde deveria vir código?
 *
 * `null` quando não há nada a dizer — a ausência de aviso é a resposta comum, e
 * um aviso que aparece sempre deixa de ser lido.
 *
 * A linha entra na conta quando o SKU **ou** o código do ERP é palavra: nos 22
 * casos medidos os dois campos vinham iguais, mas um ERP que preencha só um
 * deles produz o mesmo estrago.
 */
/**
 * As linhas que são MARCADOR — a decisão completa, com a guarda do catálogo.
 *
 * É esta que decide, e não `ehPalavraNoLugarDoCodigo`. Ela existe separada do
 * aviso porque `scripts/apagarProdutosMarcadores.mjs` precisa da MESMA decisão
 * para escolher o que apagar — e a primeira versão dele usava o predicado de um
 * valor só, o que teria apagado um catálogo de móvel inteiro.
 *
 * Devolve lista vazia quando o catálogo não tem convenção numérica: ali "sem
 * dígito" é o normal, e um marcador de texto é indistinguível dos outros.
 * Perder esse caso é o preço de não apagar o catálogo — e é o preço certo,
 * porque o outro erro não tem volta.
 */
export function marcadoresDoCatalogo<T extends LinhaComCodigo>(
  linhas: readonly T[]
): T[] {
  if (linhas.length === 0) return [];
  const comDigito = linhas.filter(
    (l) => /[0-9]/.test(String(l.sku ?? "")) || /[0-9]/.test(String(l.codErp ?? ""))
  ).length;
  if (comDigito / linhas.length < CONVENCAO_NUMERICA) return [];
  return linhas.filter(
    (l) => ehPalavraNoLugarDoCodigo(l.sku) || ehPalavraNoLugarDoCodigo(l.codErp)
  );
}

export function avisoDeCodigoQueEPalavra(
  linhas: readonly LinhaComCodigo[]
): AvisoDeCodigo | null {
  const afetadas = marcadoresDoCatalogo(linhas);
  if (afetadas.length === 0) return null;

  const frequencia = new Map<string, number>();
  for (const l of afetadas) {
    const palavra = (
      ehPalavraNoLugarDoCodigo(l.sku) ? l.sku : (l.codErp ?? "")
    ).trim();
    frequencia.set(palavra, (frequencia.get(palavra) ?? 0) + 1);
  }
  const palavras = [...frequencia.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([p]) => p);

  const exemplos = afetadas
    .map((l) => l.nome.trim())
    .filter(Boolean)
    .slice(0, MAX_EXEMPLOS);

  const amostra = palavras.slice(0, MAX_PALAVRAS);
  const eOutras = palavras.length > MAX_PALAVRAS ? `, entre outras` : "";
  const quantas =
    afetadas.length === 1 ? "1 produto vem" : `${afetadas.length} produtos vêm`;

  // A FRASE DIZ A CONSEQUÊNCIA, não o fato. "22 SKUs inválidos" não move
  // ninguém; "eles entram como produto e vão pedir foto e preço" move.
  const texto =
    `${quantas} com uma palavra no lugar do código: ${amostra.map((p) => `"${p}"`).join(", ")}${eOutras}. ` +
    `Em ERP isso costuma ser um recado — produto fora de linha, brinde, kit — e não um código. ` +
    `Se importar assim, eles entram como produto normal: contam no catálogo, pedem foto e preço, ` +
    `e podem chegar até a publicação. Confira antes se essas linhas deviam mesmo virar produto.`;

  return { linhas: afetadas.length, palavras, exemplos, texto };
}
