// O cabeçalho tem mais colunas do que as linhas de dados.
//
// ===========================================================================
// O ARQUIVO QUE PRODUZIU ISTO — 27/08/2026
// ===========================================================================
//
// Um relatório do Linx, exportado para completar preço e estoque:
//
//     cabeçalho   REPORTGROUP;CODIGO;DESCRICAO;CORX;QUANTIDADE;PRECO;...;MARKUP;
//     dados       "006098";"SLIME GELELE...";"SORTIDO";1,000;46,90;25,13;...
//
//     11 campos no cabeçalho · 9 em TODAS as 1505 linhas
//
// `REPORTGROUP` é coluna de agrupamento do relatório: existe no título e não sai
// nas linhas. Some ela, e tudo o que vem depois anda uma casa.
//
// O estrago não é cosmético. Zipando cabeçalho com dados na ordem:
//
//     PRECO      recebe  25,13   que é o CUSTO
//     QUANTIDADE recebe  46,90   que é o PREÇO
//     CORX       recebe  1,000   que é a QUANTIDADE
//
// Ou seja: importar assim gravaria o custo no preço de venda e o preço no
// estoque. Dinheiro no campo errado, sem uma linha de aviso — a mesma classe
// dos 87 custos falsos que este repositório já pagou.
//
// ===========================================================================
// AVISA, NÃO CONSERTA
// ===========================================================================
//
// Deslocar sozinho seria adivinhar QUAL coluna sobra. Aqui sobra a primeira;
// noutro relatório pode sobrar a última, ou duas do meio. O que dá para afirmar
// com certeza é que os números não batem — e isso basta para a pessoa olhar os
// exemplos e corrigir o mapeamento, que a tela já permite.
//
// A mesma regra de `gradeAchatada` e `pesoImplausivel`: medir, dizer, e deixar
// a decisão com quem conhece o arquivo.
//
// ===========================================================================
// O ; DO FIM NÃO É COLUNA — E ESSA GUARDA VEIO DE UM FALSO ALARME MEU
// ===========================================================================
//
// A primeira versão comparava só os NÚMEROS, e acusou o arquivo seguinte, que
// estava correto:
//
//     cabeçalho  ...;ULTIMACOMPRA;MARKUP;     11 campos, o último sem nome
//     dados      ...;/  /;354,20              10 campos
//
// A linha do cabeçalho termina em `;`, o que produz um 11º campo VAZIO. Os
// dados não repetem esse separador, e daí a diferença de um. Nada está
// desalinhado: `CODIGO` traz código, `PRECO` traz preço.
//
// Terminador solto é comum em exportação de ERP. Um detector que grita nele
// grita em quase todo arquivo — e alarme que sempre toca se aprende a ignorar,
// inclusive quando é de verdade. Por isso nomes VAZIOS NO FIM não contam.

export interface CabecalhoDesalinhado {
  /** `false` = cabeçalho e dados batem, e não há o que dizer. */
  desalinhado: boolean;
  colunasNoCabecalho: number;
  /** Quantos campos as linhas de dados têm. Vazio quando não há linha. */
  camposNasLinhas: number[];
  /** A frase pronta, ou "" quando está tudo alinhado. */
  texto: string;
}

const NADA: CabecalhoDesalinhado = {
  desalinhado: false,
  colunasNoCabecalho: 0,
  camposNasLinhas: [],
  texto: "",
};

/**
 * Compara a largura do cabeçalho com a das linhas.
 *
 * `camposPorLinha` vem do leitor de CSV, ANTES de virar registro: depois que os
 * campos são zipados com os nomes, a informação de quantos havia já se perdeu —
 * e é justamente ela que denuncia o problema.
 *
 * Uma linha mais CURTA é o caso perigoso: os nomes seguem em frente e os valores
 * ficam para trás. Uma linha mais LONGA perde o excedente, o que também merece
 * aviso, mas não desloca o que já casou.
 */
export function cabecalhoDesalinhado(
  headers: readonly string[],
  camposPorLinha: readonly number[]
): CabecalhoDesalinhado {
  const colunasNoCabecalho = headers.length;
  if (colunasNoCabecalho <= 0 || camposPorLinha.length === 0) return NADA;

  // Quantos nomes existem de verdade, descontando os vazios do FIM. Vazio no
  // MEIO continua contando: ali some uma coluna com dado, e é justamente o que
  // este detector procura.
  let nomeados = colunasNoCabecalho;
  while (nomeados > 0 && !(headers[nomeados - 1] ?? "").trim()) nomeados--;

  const cabe = (n: number) => n === colunasNoCabecalho || n === nomeados;
  const distintos = [...new Set(camposPorLinha.filter((n) => !cabe(n)))].sort((a, b) => a - b);
  const diferentes = camposPorLinha.filter((n) => !cabe(n)).length;
  if (diferentes === 0) return NADA;

  const quantas =
    diferentes === camposPorLinha.length
      ? `TODAS as ${camposPorLinha.length} linhas`
      : `${diferentes} de ${camposPorLinha.length} linhas`;
  const larguras =
    distintos.length === 1 ? `${distintos[0]}` : `${distintos.join(", ")}`;

  return {
    desalinhado: true,
    colunasNoCabecalho: nomeados,
    camposNasLinhas: distintos,
    texto:
      `O cabeçalho tem ${nomeados} colunas, mas ${quantas} têm ${larguras}. ` +
      `Quando isso acontece, os valores entram debaixo do nome errado — o preço pode ` +
      `aparecer na coluna de estoque, e o custo na de preço. Confira o exemplo de cada ` +
      `coluna abaixo antes de importar: se o valor não combina com o nome, mude o papel ` +
      `da coluna (ou corrija o arquivo no ERP).`,
  };
}
