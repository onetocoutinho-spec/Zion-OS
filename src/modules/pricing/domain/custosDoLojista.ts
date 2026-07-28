// Os custos que não são o marketplace — puro, sem rede, sem React.
//
// POR QUE ISTO EXISTE
//
// O modelo do Zion cobrava comissão, taxa fixa e frete, chamava isso de "custo
// da venda" e declarava a margem. Faltava quase tudo o que o lojista realmente
// paga.
//
// A conta que a Chinelaria Leilane mantém à mão, em planilha, tem dez linhas:
//
//   custo do produto
//   + embalagem R$ 0,50 + etiqueta R$ 0,15 + informativos R$ 0,50
//   + comissão do marketplace (%)  + taxa fixa
//   + comissão do gestor 1%  + Simples Nacional 12%  + comissão do ERP 1%
//
// O Zion conhecia três dessas linhas. As que faltavam somam **14 pontos
// percentuais** e R$ 1,15 por pedido — e o efeito não é acadêmico: numa
// sandália de R$ 150 a margem caía de 20,7% (o que o Zion dizia) para ~6% (o
// que a planilha dela diz). O sistema declarava "Saudável" um produto apertado.
//
// Otimismo em precificação não aparece como erro. Aparece como margem que some.
//
// CADA LOJISTA TEM OS SEUS
//
// A alíquota depende do regime tributário, a comissão interna depende de como a
// operação é montada, a embalagem depende do que se compra. Nada disso pode ser
// constante no código — por isso os valores vêm de fora, e o DEFAULT DE TUDO É
// ZERO: quem não preencheu nada calcula exatamente como calculava antes.

/**
 * O que o lojista paga além do marketplace.
 *
 * Percentuais incidem sobre o PREÇO DE VENDA (é assim que imposto e comissão
 * interna são cobrados, e é assim que a planilha dela calcula). Os fixos são
 * por pedido.
 */
export interface CustosDoLojista {
  /** Embalagem, em R$ por pedido. */
  embalagem: number;
  /** Etiqueta, em R$ por pedido. */
  etiqueta: number;
  /** Encartes/informativos que vão na caixa, em R$ por pedido. */
  informativos: number;
  /** Imposto sobre a venda, em % do preço (ex.: Simples Nacional 12). */
  impostoPercentual: number;
  /** Comissão de quem opera a conta, em % do preço. */
  comissaoGestorPercentual: number;
  /** Comissão do ERP/sistema, em % do preço. */
  comissaoSistemaPercentual: number;
  /**
   * Cupom de campanha, em % do preço.
   *
   * Fica separado do imposto de propósito: imposto é permanente, cupom é
   * decisão de campanha. Somar os dois num "outros %" esconderia que dá para
   * desligar um e não o outro.
   */
  cupomPercentual: number;
}

/** Ninguém preencheu nada: calcula igual a antes. */
export const SEM_CUSTOS_DO_LOJISTA: CustosDoLojista = {
  embalagem: 0,
  etiqueta: 0,
  informativos: 0,
  impostoPercentual: 0,
  comissaoGestorPercentual: 0,
  comissaoSistemaPercentual: 0,
  cupomPercentual: 0,
};

/** Um número que serve como dinheiro/percentual, ou 0. Nunca NaN, nunca negativo. */
function saudavel(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Normaliza o que vier de fora (banco, formulário, API).
 *
 * Percentual acima de 100 é recusado e vira 0: um imposto de 1200% viria de um
 * campo digitado errado, e aceitar transformaria a tela num gerador de preços
 * absurdos — o mesmo tipo de silêncio que já gravou R$ 30 milhões de custo.
 */
export function normalizarCustos(bruto: Partial<CustosDoLojista> | null | undefined): CustosDoLojista {
  const b = bruto ?? {};
  const pct = (v: unknown) => {
    const n = saudavel(v);
    return n < 100 ? n : 0;
  };
  return {
    embalagem: saudavel(b.embalagem),
    etiqueta: saudavel(b.etiqueta),
    informativos: saudavel(b.informativos),
    impostoPercentual: pct(b.impostoPercentual),
    comissaoGestorPercentual: pct(b.comissaoGestorPercentual),
    comissaoSistemaPercentual: pct(b.comissaoSistemaPercentual),
    cupomPercentual: pct(b.cupomPercentual),
  };
}

/** Quanto o lojista paga por pedido, independente do preço. */
export function fixosDoLojista(c: CustosDoLojista): number {
  return Math.round((c.embalagem + c.etiqueta + c.informativos) * 100) / 100;
}

/**
 * A soma dos percentuais que incidem sobre o preço.
 *
 * Entra no MESMO divisor da comissão do marketplace: todos são fatias do preço,
 * e é por isso que o preço mínimo se resolve por divisão e não por soma. Foi
 * assim que a planilha dela chegou ao `(custo + 5,15) / 0,66`.
 */
export function percentuaisDoLojista(c: CustosDoLojista): number {
  return (
    c.impostoPercentual + c.comissaoGestorPercentual + c.comissaoSistemaPercentual + c.cupomPercentual
  );
}

/** O quanto os percentuais custam num preço dado, em reais. */
export function custoPercentualEmReais(preco: number, c: CustosDoLojista): number {
  if (!(preco > 0)) return 0;
  return Math.round(((preco * percentuaisDoLojista(c)) / 100) * 100) / 100;
}

/** Há algo preenchido? Serve para a tela saber se avisa que a conta está incompleta. */
export function temCustosInformados(c: CustosDoLojista): boolean {
  return fixosDoLojista(c) > 0 || percentuaisDoLojista(c) > 0;
}
