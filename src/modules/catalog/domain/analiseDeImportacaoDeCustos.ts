// A prévia de uma importação de custos — puro, sem React, sem rede, sem
// gravar nada.
//
// ============================================================
// O PROBLEMA QUE ISTO EXISTE PARA RESPONDER
// ============================================================
//
// `importarCustos` sobrescreve `produtos.custo` em silêncio quando o produto
// já tinha um valor — a detecção de disputa hoje só compara linhas DENTRO da
// mesma planilha entre si, nunca contra o que já está gravado. Numa
// importação com centenas de produtos divergindo do catálogo, tratar cada um
// como uma pendência individual erraria a pergunta: a planilha inteira está
// propondo uma tabela de custo nova, e a decisão é "aceito esta fonte?", não
// "decida linha por linha".
//
// Este módulo é o primeiro passo dessa prévia: medir, para cada produto que
// casou, o quanto o valor novo se afasta do atual — SEM decidir ainda o que
// fazer com isso. O limite que separa "grava direto" de "vira pendência"
// entra depois, calibrado com a distribuição real que este módulo produz.

/**
 * O quanto um custo novo se afasta do que já estava gravado.
 *
 * `variacaoPercentual` é `null` quando `custoAtual` é 0 — não há de onde
 * variar. Isso NÃO é o caso "ausente → ganhou custo" tratado como se fosse
 * uma variação de 100%; é uma categoria própria (ver `DistribuicaoDeVariacao`).
 */
export interface VariacaoDeCusto {
  produtoId: string;
  custoAtual: number;
  custoNovo: number;
  /** `(novo - atual) / atual`. `null` quando `custoAtual <= 0`. */
  variacaoPercentual: number | null;
  /** `|novo - atual|`, sempre um número — mesmo quando `custoAtual` é 0. */
  variacaoAbsoluta: number;
}

/** Compara um custo atual com um custo novo. PURA. */
export function calcularVariacao(
  produtoId: string,
  custoAtual: number,
  custoNovo: number
): VariacaoDeCusto {
  return {
    produtoId,
    custoAtual,
    custoNovo,
    variacaoPercentual: custoAtual > 0 ? (custoNovo - custoAtual) / custoAtual : null,
    variacaoAbsoluta: Math.abs(custoNovo - custoAtual),
  };
}

/**
 * Estatísticas descritivas de uma lista de números — min, máximo, média,
 * mediana e os percentis que importam para calibrar um limite (a maioria dos
 * casos fica abaixo de qual valor?).
 *
 * `null` quando a lista está vazia: média de nada não é zero, é "não há
 * amostra" — mesma regra de `estadoAssincrono`, zero não é a resposta segura
 * para ausência.
 */
export interface EstatisticasDescritivas {
  amostras: number;
  min: number;
  max: number;
  media: number;
  mediana: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}

/**
 * O percentil pelo método "nearest-rank" sobre uma lista JÁ ORDENADA.
 *
 * Não é o único método de interpolação que existe, mas é o mais simples de
 * auditar à mão — "o valor na posição X% da lista ordenada" — e a diferença
 * entre métodos de interpolação não muda a decisão de onde pôr um limite
 * quando a amostra tem centenas de pontos.
 */
function percentil(ordenados: readonly number[], p: number): number {
  if (ordenados.length === 0) return 0;
  const indice = Math.min(
    ordenados.length - 1,
    Math.ceil((p / 100) * ordenados.length) - 1
  );
  return ordenados[Math.max(0, indice)];
}

export function estatisticas(valores: readonly number[]): EstatisticasDescritivas | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const soma = ordenados.reduce((t, v) => t + v, 0);
  return {
    amostras: ordenados.length,
    min: ordenados[0],
    max: ordenados[ordenados.length - 1],
    media: soma / ordenados.length,
    mediana: percentil(ordenados, 50),
    p75: percentil(ordenados, 75),
    p90: percentil(ordenados, 90),
    p95: percentil(ordenados, 95),
    p99: percentil(ordenados, 99),
  };
}

/**
 * A distribuição de uma importação inteira — o resumo que a prévia mostra
 * antes de qualquer gravação.
 *
 * As categorias são EXCLUSIVAS e cobrem `variacoes` inteiro: todo item cai em
 * exatamente uma. `percentual`/`absoluta` descrevem só quem está em
 * `comMudanca` — incluir os sem-custo-anterior ou os sem-mudança na mesma
 * amostra distorceria a distribuição que o limite precisa calibrar.
 */
export interface DistribuicaoDeVariacao {
  total: number;
  /** `custoAtual === 0` — não é variação, é primeira vez. */
  semCustoAnterior: number;
  /** `custoAtual === custoNovo` — a planilha reafirma o que já estava lá. */
  semMudanca: number;
  /** O resto: tinha custo, e o novo é diferente. É sobre este grupo que as estatísticas abaixo falam. */
  comMudanca: number;
  /** Estatísticas de `|variacaoPercentual|` (valor absoluto — direção não importa para o limite). */
  percentual: EstatisticasDescritivas | null;
  /** Estatísticas de `variacaoAbsoluta`, em reais. */
  absoluta: EstatisticasDescritivas | null;
}

export function distribuicaoDeVariacao(
  variacoes: readonly VariacaoDeCusto[]
): DistribuicaoDeVariacao {
  const semCustoAnterior = variacoes.filter((v) => v.custoAtual <= 0);
  const comCustoAnterior = variacoes.filter((v) => v.custoAtual > 0);
  const semMudanca = comCustoAnterior.filter((v) => v.custoNovo === v.custoAtual);
  const comMudanca = comCustoAnterior.filter((v) => v.custoNovo !== v.custoAtual);

  return {
    total: variacoes.length,
    semCustoAnterior: semCustoAnterior.length,
    semMudanca: semMudanca.length,
    comMudanca: comMudanca.length,
    percentual: estatisticas(
      comMudanca
        .map((v) => v.variacaoPercentual)
        .filter((v): v is number => v !== null)
        .map(Math.abs)
    ),
    absoluta: estatisticas(comMudanca.map((v) => v.variacaoAbsoluta)),
  };
}
