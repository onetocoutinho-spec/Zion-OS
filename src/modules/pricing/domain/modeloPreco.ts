// Modelo de preço — puro, sem rede, sem React.
//
// A margem mínima é escolha do lojista (migração 029). As TAXAS, que antes eram
// quatro números fixos e errados, agora vêm de `custosML`:
//
//   comissão   → % por tipo de anúncio (Clássico 14% / Premium 19% em Moda)
//   custo fixo → por faixa de PREÇO, e só ABAIXO do limiar de R$ 79
//   frete      → por PESO cobrável (o maior entre real e cubado), só a partir
//                do limiar, com subsídio de reputação
//
// O que havia antes: comissão 30% (11 pontos fictícios), custo fixo de R$ 1,15
// cobrado em TODOS os preços (o ML cobra só abaixo do limiar) e frete de R$
// 14,15 fixo. Os dois primeiros erram em direções opostas: em produto barato se
// cancelavam, em produto caro se somavam — o piso saía até 27% acima do real.
//
// ⚠️ ONDE FALTA DADO, O RESULTADO É null — nunca um número plausível.
// Sem tabela de frete não há como saber o custo de envio de um item acima do
// limiar. Devolver zero faria o piso parecer MENOR do que é, que é o erro
// perigoso: o lojista venderia no prejuízo sem saber. null vira pendência
// visível na tela.

import {
  COMISSAO_MODA,
  LIMIAR_FRETE_GRATIS,
  PRECO_MINIMO_VENDAVEL,
  TABELA_CUSTO_FIXO,
  comissaoDoAnuncio,
  custoFixoPorPreco,
  fretePorPeso,
  pesoCobravelGramas,
  type ComissaoPorTipo,
  type Embalagem,
  type FaixaCustoFixo,
  type TabelaFrete,
} from "./custosML.ts";

export {
  LIMIAR_FRETE_GRATIS,
  COMISSAO_MODA,
  type Embalagem,
  type TabelaFrete,
  type ComissaoPorTipo,
};

/** Tudo o que decide quanto uma venda custa. */
export interface ModeloTaxas {
  /** Comissão da categoria, por tipo de anúncio. */
  comissao: ComissaoPorTipo;
  /** "Clássico" ou "Premium" — vem do canal do cliente. */
  tipoAnuncio: string;
  tabelaCustoFixo: readonly FaixaCustoFixo[];
  /** Do painel do lojista. null = desconhecida, e o frete vira pendência. */
  tabelaFrete: TabelaFrete | null;
  /** Medidas da variante. null = sem peso, e o frete vira pendência. */
  embalagem: Embalagem | null;
  /** Subsídio do ML sobre o frete de tabela (até 70%, conforme reputação). */
  subsidioFretePercentual: number;
}

/**
 * O padrão espelha o que o sistema sabe hoje: categoria Moda, canal Premium
 * (o default de `canaisMarketplace`), e frete DESCONHECIDO — porque não existe
 * tabela pública estável, e inventar uma seria pior do que admitir a falta.
 */
export const TAXAS_PADRAO: ModeloTaxas = {
  comissao: COMISSAO_MODA,
  tipoAnuncio: "Premium",
  tabelaCustoFixo: TABELA_CUSTO_FIXO,
  tabelaFrete: null,
  embalagem: null,
  subsidioFretePercentual: 0,
};

/** O piso que a Zion assumia pelo lojista. Vira apenas o valor inicial dele. */
export const MARGEM_MINIMA_PADRAO = 5;
export const MARGEM_MINIMA_PERMITIDA = 0;
export const MARGEM_MAXIMA_PERMITIDA = 60;

function arredondar(v: number): number {
  return Math.round(v * 100) / 100;
}

/** A comissão em % que vale para este modelo. */
export function comissaoPercentual(taxas: ModeloTaxas = TAXAS_PADRAO): number {
  return comissaoDoAnuncio(taxas.tipoAnuncio, taxas.comissao);
}

/** O frete do vendedor, ou null quando falta peso ou tabela. */
export function freteDoModelo(taxas: ModeloTaxas = TAXAS_PADRAO): number | null {
  if (!taxas.embalagem || !taxas.tabelaFrete) return null;
  const peso = pesoCobravelGramas(taxas.embalagem);
  return fretePorPeso(peso, taxas.tabelaFrete, taxas.subsidioFretePercentual);
}

export interface CustoDaVenda {
  comissao: number;
  custoFixo: number;
  /** null quando o preço atinge o limiar e o frete não é conhecido. */
  frete: number | null;
  /** null quando alguma parcela é desconhecida — nunca um total parcial. */
  total: number | null;
  /** O que falta para fechar a conta. Vazio quando o total é confiável. */
  pendencia: string | null;
}

/**
 * Quanto o marketplace leva desta venda. Puro.
 *
 * Abaixo do limiar o frete não é do vendedor, então a conta fecha sempre. A
 * partir do limiar o frete entra, e sem peso ou sem tabela o total é null.
 */
export function custoDaVenda(
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): CustoDaVenda {
  if (preco <= 0) {
    return { comissao: 0, custoFixo: 0, frete: 0, total: 0, pendencia: null };
  }

  const comissao = arredondar((preco * comissaoPercentual(taxas)) / 100);
  const abaixoDoLimiar = preco < LIMIAR_FRETE_GRATIS;

  if (abaixoDoLimiar) {
    const fixo = custoFixoPorPreco(preco, taxas.tabelaCustoFixo);
    if (fixo === null) {
      return {
        comissao,
        custoFixo: 0,
        frete: 0,
        total: null,
        pendencia: `Preço abaixo do mínimo vendável no Mercado Livre (R$ ${PRECO_MINIMO_VENDAVEL}).`,
      };
    }
    return { comissao, custoFixo: fixo, frete: 0, total: arredondar(comissao + fixo), pendencia: null };
  }

  // A partir do limiar: sem custo fixo, com frete por conta do vendedor.
  const frete = freteDoModelo(taxas);
  if (frete === null) {
    return {
      comissao,
      custoFixo: 0,
      frete: null,
      total: null,
      pendencia: !taxas.embalagem
        ? "Falta o peso e as medidas da variante para calcular o frete."
        : "Falta a tabela de frete da sua conta no Mercado Livre.",
    };
  }
  return { comissao, custoFixo: 0, frete, total: arredondar(comissao + frete), pendencia: null };
}

/** Soma das taxas, ou null quando alguma parcela é desconhecida. */
export function custoDasTaxas(
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  return custoDaVenda(preco, taxas).total;
}

/** Lucro em reais, ou null quando as taxas não fecham. */
export function lucroLiquido(
  custo: number,
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  if (preco <= 0) return 0;
  const total = custoDasTaxas(preco, taxas);
  if (total === null) return null;
  return arredondar(preco - custo - total);
}

/** Margem líquida em % sobre o preço, ou null quando as taxas não fecham. */
export function margemLiquida(
  custo: number,
  preco: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  if (preco <= 0) return 0;
  const lucro = lucroLiquido(custo, preco, taxas);
  if (lucro === null) return null;
  return Math.round((lucro / preco) * 1000) / 10;
}

export type ResultadoPrecoMinimo =
  | { ok: true; preco: number }
  /** comissão + margem ≥ 100%: não existe preço que satisfaça. */
  | { ok: false; motivo: "margem_impossivel" }
  /**
   * O piso cruza o limiar e o frete é desconhecido. `pisoSemFrete` é um limite
   * INFERIOR real: o preço certo é maior. Mostrar como "a partir de", nunca
   * como o valor final.
   */
  | { ok: false; motivo: "frete_desconhecido"; pisoSemFrete: number; pendencia: string };

/**
 * O menor preço que ainda entrega a margem escolhida pelo lojista.
 *
 * Resolve preco = (custo + parcelas fixas) / (1 − comissão − margem). As
 * parcelas mudam conforme o preço cruza o limiar, então o cálculo é feito
 * abaixo do limiar primeiro e refeito acima se o resultado passar da linha.
 */
export function precoMinimo(
  custo: number,
  margemDesejada: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): ResultadoPrecoMinimo {
  const divisor = 1 - comissaoPercentual(taxas) / 100 - margemDesejada / 100;
  if (divisor <= 0) return { ok: false, motivo: "margem_impossivel" };

  // Hipótese 1: o preço fica ABAIXO do limiar → incide custo fixo, sem frete.
  //
  // O custo fixo muda por faixa de preço, e o preço é justamente o que se quer
  // descobrir — então cada faixa gera um candidato, e vale o primeiro que cai
  // DENTRO da própria faixa. Usar sempre a faixa mais cara entregaria margem
  // acima da pedida em produto barato: erra para o lado seguro, mas erra.
  for (const faixa of taxas.tabelaCustoFixo) {
    const candidato = (custo + faixa.valor) / divisor;
    if (candidato <= faixa.atePreco) return { ok: true, preco: arredondar(candidato) };
  }

  // Hipótese 2: o preço fica NO limiar ou acima → sem custo fixo, com frete.
  const frete = freteDoModelo(taxas);
  if (frete === null) {
    return {
      ok: false,
      motivo: "frete_desconhecido",
      pisoSemFrete: arredondar(Math.max(custo / divisor, LIMIAR_FRETE_GRATIS)),
      pendencia: !taxas.embalagem
        ? "Falta o peso e as medidas da variante para calcular o frete."
        : "Falta a tabela de frete da sua conta no Mercado Livre.",
    };
  }
  return { ok: true, preco: arredondar(Math.max((custo + frete) / divisor, LIMIAR_FRETE_GRATIS)) };
}

/** Atalho para quem só quer o número e trata a ausência como desconhecida. */
export function precoMinimoOuNull(
  custo: number,
  margemDesejada: number,
  taxas: ModeloTaxas = TAXAS_PADRAO
): number | null {
  const r = precoMinimo(custo, margemDesejada, taxas);
  return r.ok ? r.preco : null;
}

/** Puro: a margem escolhida é utilizável? */
export function margemValida(margem: number, taxas: ModeloTaxas = TAXAS_PADRAO): boolean {
  if (!Number.isFinite(margem)) return false;
  if (margem < MARGEM_MINIMA_PERMITIDA || margem > MARGEM_MAXIMA_PERMITIDA) return false;
  return comissaoPercentual(taxas) / 100 + margem / 100 < 1;
}

export type SaudeMargem = "Saudável" | "Atenção" | "Risco" | "Prejuízo" | "—";

/**
 * A saúde é medida contra a margem que O LOJISTA escolheu. Margem desconhecida
 * não vira veredito: "—" é honesto, "Saudável" seria mentira.
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
