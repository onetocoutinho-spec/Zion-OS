// O DIAGNÓSTICO de vendas — o que mudou entre duas janelas, e o que os dados
// NÃO dizem.
//
// "Por que minhas vendas caíram?" não tinha caminho: nenhuma ferramenta do
// Copilot sabia de venda, e "por que" virava reescrita de anúncio. Aqui a
// resposta é DIFERENCIAL: a janela atual contra a anterior de mesmo tamanho,
// por produto, com os números que existem — e uma lista explícita do que não
// existe (visitas, cliques, conversão), porque sem eles "título fraco" e
// "preço errado" não se distinguem, e afirmar um dos dois seria chute.
// (Auditoria do Copilot, 2026-08-22, roadmap NEXT item 6.)
//
// Puro: métricas entram, leitura sai. Nenhum número nasce aqui que não venha
// das métricas.

import type { MetricasVendas } from "@/lib/services/vendasML";

export interface LeituraDeVendas {
  periodoDias: number;
  atual: Resumo;
  anterior: Resumo;
  /** Variação do faturamento, em %, com uma casa. `null` sem base (anterior zero). */
  variacaoFaturamento: number | null;
  variacaoPedidos: number | null;
  /** Quem mais caiu e quem mais subiu, por faturamento. Até 5 cada. */
  quedas: MovimentoDeProduto[];
  altas: MovimentoDeProduto[];
  /** Produtos que vendiam antes e zeraram agora — o sinal mais forte de "saiu do ar". */
  sumiram: string[];
  /** O que os dados NÃO cobrem. Sempre presente; o modelo repete, não omite. */
  oQueNaoSei: string[];
}

export interface Resumo {
  faturamento: number;
  pedidos: number;
  unidades: number;
  ticketMedio: number;
  margem: number;
  coberturaCusto: number;
}

export interface MovimentoDeProduto {
  titulo: string;
  faturamentoAntes: number;
  faturamentoAgora: number;
  unidadesAntes: number;
  unidadesAgora: number;
  /** `null` quando não havia base. */
  variacao: number | null;
}

function resumo(m: MetricasVendas): Resumo {
  return {
    faturamento: arred(m.faturamento),
    pedidos: m.pedidos,
    unidades: m.unidades,
    ticketMedio: arred(m.ticketMedio),
    margem: m.margem,
    coberturaCusto: m.coberturaCusto,
  };
}

const arred = (n: number) => Math.round(n * 100) / 100;

export function variacaoPercentual(antes: number, agora: number): number | null {
  if (antes <= 0) return null;
  return Math.round(((agora - antes) / antes) * 1000) / 10;
}

export const O_QUE_NAO_SEI: readonly string[] = [
  "visitas e cliques dos anúncios (o Mercado Livre não entrega isso por aqui ainda)",
  "taxa de conversão — sem visitas não dá para separar 'ninguém viu' de 'viram e não compraram'",
  "posição na busca do Mercado Livre e o que os concorrentes fizeram no período",
  "estoque zerado no meio do período (só o que foi vendido aparece aqui)",
];

/**
 * A leitura de duas janelas de mesmo tamanho. `produtos` são os `topProdutos`
 * de cada métrica — é tudo o que `calcularMetricas` guarda por produto, e é
 * por isso que a comparação por produto cobre os mais relevantes, não todos.
 */
export function diagnosticoDeVendas(
  periodoDias: number,
  atual: MetricasVendas,
  anterior: MetricasVendas
): LeituraDeVendas {
  const antes = new Map(anterior.topProdutos.map((p) => [p.titulo, p]));
  const agora = new Map(atual.topProdutos.map((p) => [p.titulo, p]));
  const titulos = new Set([...antes.keys(), ...agora.keys()]);

  const movimentos: MovimentoDeProduto[] = [];
  const sumiram: string[] = [];
  for (const t of titulos) {
    const a = antes.get(t);
    const b = agora.get(t);
    const fa = a?.faturamento ?? 0;
    const fb = b?.faturamento ?? 0;
    if (fa > 0 && fb === 0) sumiram.push(t);
    movimentos.push({
      titulo: t,
      faturamentoAntes: arred(fa),
      faturamentoAgora: arred(fb),
      unidadesAntes: a?.unidades ?? 0,
      unidadesAgora: b?.unidades ?? 0,
      variacao: variacaoPercentual(fa, fb),
    });
  }
  const porDelta = (m: MovimentoDeProduto) => m.faturamentoAgora - m.faturamentoAntes;
  const quedas = movimentos.filter((m) => porDelta(m) < 0).sort((x, y) => porDelta(x) - porDelta(y)).slice(0, 5);
  const altas = movimentos.filter((m) => porDelta(m) > 0).sort((x, y) => porDelta(y) - porDelta(x)).slice(0, 5);

  return {
    periodoDias,
    atual: resumo(atual),
    anterior: resumo(anterior),
    variacaoFaturamento: variacaoPercentual(anterior.faturamento, atual.faturamento),
    variacaoPedidos: variacaoPercentual(anterior.pedidos, atual.pedidos),
    quedas,
    altas,
    sumiram,
    oQueNaoSei: [...O_QUE_NAO_SEI],
  };
}
