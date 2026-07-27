// Os custos do Mercado Livre que dependem de PESO e DIMENSÃO — puro, sem rede.
//
// Este arquivo existe porque `modeloPreco.ts` trata dois dos três eixos de taxa
// como número único, e nenhum dos dois é: o custo fixo varia por faixa de PREÇO,
// e o frete varia por PESO, região e reputação. Ver DIVERGENCIAS_CONHECIDAS lá.
//
// ⚠️ LEIA ANTES DE PREENCHER A TABELA DE FRETE.
// Não existe tabela pública estável de frete do ML para usar como padrão. As
// fontes consultadas (jul/2026) são unânimes: os valores são dinâmicos e
// dependem de distância, peso (real ou cubado, o MAIOR), dimensões e reputação
// do vendedor — "consultar o painel do Mercado Livre". Por isso `fretePorPeso`
// EXIGE a tabela como parâmetro e devolve null fora da cobertura, em vez de
// devolver um número inventado. Um frete chutado vira preço de venda errado no
// anúncio de um cliente real; null vira uma pendência visível.

/** Preço a partir do qual o custo fixo por unidade deixa de incidir. */
export const LIMIAR_FRETE_GRATIS = 79;

/** Abaixo disto o ML não permite vender (limite mínimo). */
export const PRECO_MINIMO_VENDAVEL = 10;

/** Uma faixa da tabela de custo fixo: vale para preços até `atePreco`. */
export interface FaixaCustoFixo {
  atePreco: number;
  valor: number;
}

/**
 * Custo fixo por unidade, cobrado pelo ML nos itens ABAIXO do limiar.
 *
 * O código antigo aplicava R$1,15 em TODOS os preços — invertido em dois
 * sentidos: o valor está defasado e a faixa é o oposto da real (o ML cobra
 * abaixo do limiar, não acima). Valores da tabela 2026; faixas por PREÇO,
 * não por peso.
 */
export const TABELA_CUSTO_FIXO: readonly FaixaCustoFixo[] = [
  { atePreco: 20, valor: 5.5 },
  { atePreco: 78.99, valor: 6.0 },
];

/** Uma faixa da tabela de frete: vale para pesos até `atePesoGramas`. */
export interface FaixaFrete {
  atePesoGramas: number;
  valor: number;
}

/** Tabela de frete, ordenada por peso. Sem padrão: cada conta tem a sua. */
export type TabelaFrete = readonly FaixaFrete[];

/**
 * Divisor de cubagem (cm³ → gramas equivalentes).
 *
 * 6000 é o divisor de praxe no mercado brasileiro. NÃO foi confirmado contra a
 * documentação do ML — por isso é parâmetro, não número embutido no cálculo.
 */
export const DIVISOR_CUBAGEM_PADRAO = 6000;

/** Medidas da embalagem. Já existem em `ProdutoVariante` (peso em kg, resto cm). */
export interface Embalagem {
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
}

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * O peso que o ML cobra: o MAIOR entre o peso real e o cubado.
 *
 * Desde 2 de março de 2026 a cubagem entrou na conta — quem vende volumoso e
 * leve (caixa de chinelo é exatamente isso) paga pelo volume, não pela balança.
 * Medida faltando conta como zero: sem dimensão não há cubagem, e o peso real
 * prevalece — nunca o contrário, para não inflar o frete por falta de dado.
 */
export function pesoCobravelGramas(
  e: Embalagem,
  divisorCubagem: number = DIVISOR_CUBAGEM_PADRAO
): number {
  if (divisorCubagem <= 0) return Math.max(0, e.pesoGramas);
  const volume = e.alturaCm * e.larguraCm * e.comprimentoCm;
  const cubado = volume > 0 ? (volume / divisorCubagem) * 1000 : 0;
  return arredondar(Math.max(0, e.pesoGramas, cubado));
}

/**
 * Custo fixo por unidade para um preço. Puro.
 *
 * Devolve 0 no limiar ou acima (lá o custo é o frete, não este), e null abaixo
 * do mínimo vendável — onde não existe venda legítima para precificar.
 */
export function custoFixoPorPreco(
  preco: number,
  tabela: readonly FaixaCustoFixo[] = TABELA_CUSTO_FIXO
): number | null {
  if (!Number.isFinite(preco) || preco < PRECO_MINIMO_VENDAVEL) return null;
  if (preco >= LIMIAR_FRETE_GRATIS) return 0;
  const faixa = tabela.find((f) => preco <= f.atePreco);
  return faixa ? faixa.valor : null;
}

/**
 * Frete do vendedor para um peso cobrável. Puro.
 *
 * Devolve null quando o peso não está coberto pela tabela — a tabela é a fonte,
 * e extrapolar dela seria inventar o custo do envio de um produto real.
 * O subsídio do ML (até 70%, conforme reputação) entra como desconto sobre o
 * valor de tabela; 0 = sem subsídio.
 */
export function fretePorPeso(
  pesoGramas: number,
  tabela: TabelaFrete,
  subsidioPercentual = 0
): number | null {
  if (!Number.isFinite(pesoGramas) || pesoGramas < 0) return null;
  if (subsidioPercentual < 0 || subsidioPercentual > 100) return null;
  const faixa = tabela.find((f) => pesoGramas <= f.atePesoGramas);
  if (!faixa) return null;
  return arredondar(faixa.valor * (1 - subsidioPercentual / 100));
}

/**
 * Comissão do marketplace por tipo de anúncio, em %.
 *
 * `tipoAnuncio` já existe em `canais_marketplace` (default "Premium" em
 * `canaisMarketplace.ts`). Os valores são da categoria Moda (Roupa & Calçado);
 * outras categorias têm faixas próprias, por isso isto é um mapa por categoria
 * e não duas constantes soltas.
 */
export interface ComissaoPorTipo {
  classico: number;
  premium: number;
}

/** Moda / Roupa & Calçado — a categoria do cliente atual. */
export const COMISSAO_MODA: ComissaoPorTipo = { classico: 14, premium: 19 };

export function comissaoDoAnuncio(
  tipoAnuncio: string | null | undefined,
  comissao: ComissaoPorTipo = COMISSAO_MODA
): number {
  // O default espelha `canaisMarketplace.paraApp`: sem tipo, o canal é Premium.
  return tipoAnuncio === "Clássico" ? comissao.classico : comissao.premium;
}
