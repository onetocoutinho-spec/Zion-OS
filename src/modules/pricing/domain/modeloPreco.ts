// Modelo de preço — puro, sem rede, sem React.
//
// Até aqui a margem mínima (5%) e as taxas viviam espalhadas como números
// mágicos em duas telas. Isso fazia a Zion decidir pelo lojista qual lucro é
// aceitável — e ele não é agência de ninguém: quem escolhe a margem é quem
// vende.
//
// ⚠️ AS TAXAS PADRÃO REPRODUZEM O CÁLCULO DE HOJE, BYTE A BYTE.
// Elas NÃO foram corrigidas aqui de propósito. Mexer na fórmula enquanto o
// pedido era "tornar a margem editável" mudaria silenciosamente o preço que
// todo cliente já vê. As divergências levantadas contra as regras atuais do
// Mercado Livre estão anotadas em DIVERGENCIAS_CONHECIDAS, para decisão
// explícita — não para conserto silencioso.

/** As taxas que incidem sobre uma venda. Todas por unidade vendida. */
export interface ModeloTaxas {
  /** % do preço de venda retido pelo marketplace. */
  comissaoPercentual: number;
  /** Custo fixo por unidade vendida, em reais. */
  custoPorUnidade: number;
  /** Frete assumido pelo vendedor quando o preço atinge o limiar, em reais. */
  fretePorUnidade: number;
  /** Preço a partir do qual o frete passa a ser do vendedor. */
  limiarFrete: number;
}

/** O modelo vigente hoje no código. Reproduz o cálculo anterior exatamente. */
export const TAXAS_PADRAO: ModeloTaxas = {
  comissaoPercentual: 30,
  custoPorUnidade: 1.15,
  fretePorUnidade: 14.15,
  limiarFrete: 79,
};

/** O piso que a Zion assumia pelo lojista. Vira apenas o valor inicial dele. */
export const MARGEM_MINIMA_PADRAO = 5;

/** Limites de sanidade da escolha do lojista. */
export const MARGEM_MINIMA_PERMITIDA = 0;
export const MARGEM_MAXIMA_PERMITIDA = 60;

/**
 * O que separa o modelo do código das regras reais do Mercado Livre.
 * Levantado em julho de 2026; nenhum destes pontos foi alterado aqui.
 */
export const DIVERGENCIAS_CONHECIDAS = [
  "A comissão de 30% está acima da faixa real do ML (11–14% no Clássico, 16–19% no Premium). Provavelmente embute algo além da comissão do marketplace.",
  "O custo fixo por unidade é cobrado pelo ML nos itens ABAIXO do limiar, não em todos — e desde 2 de março de 2026 é variável por peso e dimensão, não fixo.",
  "O frete acima do limiar depende de peso, região e reputação do vendedor. Um valor único não representa isso, e `Produto` ainda não tem peso.",
] as const;

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Soma das taxas incidentes sobre um preço. Puro. */
export function custoDasTaxas(preco: number, taxas: ModeloTaxas = TAXAS_PADRAO): number {
  if (preco <= 0) return 0;
  const frete = preco >= taxas.limiarFrete ? taxas.fretePorUnidade : 0;
  return arredondar((preco * taxas.comissaoPercentual) / 100 + taxas.custoPorUnidade + frete);
}

/** Lucro em reais de uma venda, já descontados custo e taxas. Puro. */
export function lucroLiquido(
  custo: number,
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number {
  if (preco <= 0) return 0;
  return arredondar(preco - custo - custoDasTaxas(preco, taxas));
}

/** Margem líquida em % sobre o preço de venda. Puro. */
export function margemLiquida(
  custo: number,
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number {
  if (preco <= 0) return 0;
  return Math.round((lucroLiquido(custo, preco, taxas) / preco) * 1000) / 10;
}

/**
 * O menor preço que ainda entrega a margem escolhida pelo lojista.
 *
 * Resolve preco = (custo + custoPorUnidade + frete) / (1 − comissão − margem).
 * O frete só entra quando o próprio preço resultante atinge o limiar — por isso
 * o cálculo é feito sem frete primeiro e refeito com frete se cruzar a linha.
 *
 * Devolve null quando comissão + margem ≥ 100%: não existe preço que satisfaça,
 * e devolver um número aqui seria devolver uma mentira.
 */
export function precoMinimo(
  custo: number,
  margemDesejada: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  const divisor = 1 - taxas.comissaoPercentual / 100 - margemDesejada / 100;
  if (divisor <= 0) return null;
  const semFrete = (custo + taxas.custoPorUnidade) / divisor;
  const piso =
    semFrete >= taxas.limiarFrete
      ? (custo + taxas.custoPorUnidade + taxas.fretePorUnidade) / divisor
      : semFrete;
  return arredondar(piso);
}

/** Puro: a margem escolhida é utilizável? */
export function margemValida(margem: number, taxas: ModeloTaxas = TAXAS_PADRAO): boolean {
  if (!Number.isFinite(margem)) return false;
  if (margem < MARGEM_MINIMA_PERMITIDA || margem > MARGEM_MAXIMA_PERMITIDA) return false;
  return taxas.comissaoPercentual / 100 + margem / 100 < 1;
}

export type SaudeMargem = "Saudável" | "Atenção" | "Risco" | "Prejuízo" | "—";

/**
 * A saúde é medida contra a margem que O LOJISTA escolheu, não contra um número
 * fixo. Abaixo do piso dele é Risco; prejuízo continua sendo prejuízo.
 */
export function classificarMargem(
  margem: number | null,
  margemMinima: number
): SaudeMargem {
  if (margem === null) return "—";
  if (margem < 0) return "Prejuízo";
  if (margem < margemMinima) return "Risco";
  if (margem < margemMinima * 2) return "Atenção";
  return "Saudável";
}
