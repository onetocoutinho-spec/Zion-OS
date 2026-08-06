// Vendas do ML → métricas (faturamento, lucro líquido…) — orquestração cliente.
//
// Puxa os pedidos reais via /api/ml/vendas (que detém o segredo do app) e cruza
// com os custos dos produtos (que já temos, escopados por RLS) para calcular o
// lucro líquido. O refresh_token rotacionado é persistido.

import { buscarCanal } from "./canaisMarketplace";
import { cabecalhoAutenticacao } from "../supabase/sessao";
import { pedeReconexao } from "../../modules/integration/domain/credencialRecusada";
import type { Produto } from "../types";
import type { PedidoML } from "../marketplaces/mercadolivre";

export interface MetricasVendas {
  faturamento: number;
  pedidos: number;
  unidades: number;
  ticketMedio: number;
  taxas: number;
  custo: number;
  lucroLiquido: number;
  margem: number; // % sobre o faturamento
  coberturaCusto: number; // % de unidades com custo conhecido
  porDia: { dia: string; faturamento: number }[];
  topProdutos: { titulo: string; unidades: number; faturamento: number }[];
}

export const METRICAS_ZERO: MetricasVendas = {
  faturamento: 0,
  pedidos: 0,
  unidades: 0,
  ticketMedio: 0,
  taxas: 0,
  custo: 0,
  lucroLiquido: 0,
  margem: 0,
  coberturaCusto: 0,
  porDia: [],
  topProdutos: [],
};

/** Busca os pedidos pagos do cliente no ML (desde N dias atrás). */
export async function buscarVendasDoCliente(
  clienteId: string,
  opcoes: { dias?: number } = {}
): Promise<{ pedidos: PedidoML[]; aviso?: string; precisaReconectar?: boolean }> {
  const canal = await buscarCanal(clienteId, "Mercado Livre");
  if (!canal?.ativo) {
    return { pedidos: [], aviso: "Cliente não conectado ao Mercado Livre." };
  }
  const dias = opcoes.dias ?? 30;
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();

  // O refresh_token fica no servidor (R3): enviamos só o clienteId + a sessão.
  const resposta = await fetch("/api/ml/vendas", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ clienteId, desde }),
  });
  const dados = (await resposta.json()) as {
    pedidos?: PedidoML[];
    erro?: string;
  };
  if (!resposta.ok) {
    // `precisaReconectar` existe para a tela NÃO afirmar "nenhuma venda".
    //
    // Com a credencial recusada, `pedidos` vem vazio — e vazio aqui significa
    // "não consegui perguntar", nunca "ela não vendeu". A tela desenhava a
    // interface inteira de zero vendas, com o subtítulo "Nenhuma venda nos
    // últimos 30 dias" e sete cartões de R$ 0, em cima de uma lista que ninguém
    // conseguiu ler. É a ausência virando afirmação, de novo.
    return {
      pedidos: [],
      aviso: dados.erro ?? "Falha ao buscar vendas.",
      precisaReconectar: pedeReconexao(dados),
    };
  }
  return { pedidos: dados.pedidos ?? [] };
}

/** Custo por SKU (sku ou codErp do produto). */
function mapaCusto(produtos: Produto[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of produtos) {
    if (p.custo > 0) {
      if (p.sku) m.set(p.sku.trim(), p.custo);
      if (p.codErp) m.set(p.codErp.trim(), p.custo);
    }
  }
  return m;
}

/** Calcula as métricas a partir dos pedidos + custos dos produtos. */
export function calcularMetricas(pedidos: PedidoML[], produtos: Produto[]): MetricasVendas {
  if (pedidos.length === 0) return METRICAS_ZERO;
  const custos = mapaCusto(produtos);

  let faturamento = 0;
  let taxas = 0;
  let unidades = 0;
  let custo = 0;
  let unidadesComCusto = 0;
  const porDiaMap = new Map<string, number>();
  const prodMap = new Map<string, { titulo: string; unidades: number; faturamento: number }>();

  for (const ped of pedidos) {
    faturamento += ped.total;
    taxas += ped.taxas;
    const dia = (ped.data || "").slice(0, 10);
    if (dia) porDiaMap.set(dia, (porDiaMap.get(dia) ?? 0) + ped.total);

    for (const it of ped.itens) {
      unidades += it.qtd;
      const receitaItem = it.precoUnit * it.qtd;
      const c = custos.get(it.sku);
      if (c != null) {
        custo += c * it.qtd;
        unidadesComCusto += it.qtd;
      }
      const chave = it.sku || it.itemId || it.titulo;
      const atual = prodMap.get(chave) ?? { titulo: it.titulo || it.sku || "Produto", unidades: 0, faturamento: 0 };
      atual.unidades += it.qtd;
      atual.faturamento += receitaItem;
      prodMap.set(chave, atual);
    }
  }

  const lucroLiquido = faturamento - taxas - custo;
  return {
    faturamento,
    pedidos: pedidos.length,
    unidades,
    ticketMedio: pedidos.length > 0 ? faturamento / pedidos.length : 0,
    taxas,
    custo,
    lucroLiquido,
    margem: faturamento > 0 ? Math.round((lucroLiquido / faturamento) * 1000) / 10 : 0,
    coberturaCusto: unidades > 0 ? Math.round((unidadesComCusto / unidades) * 100) : 0,
    porDia: [...porDiaMap.entries()].map(([dia, f]) => ({ dia, faturamento: f })).sort((a, b) => (a.dia < b.dia ? -1 : 1)),
    topProdutos: [...prodMap.values()].sort((a, b) => b.faturamento - a.faturamento).slice(0, 6),
  };
}

/** Busca + calcula, escopado por cliente. */
export async function metricasDeVendas(
  clienteId: string,
  produtos: Produto[],
  opcoes: { dias?: number } = {}
): Promise<{ metricas: MetricasVendas; aviso?: string; precisaReconectar?: boolean }> {
  const { pedidos, aviso, precisaReconectar } = await buscarVendasDoCliente(clienteId, opcoes);
  return { metricas: calcularMetricas(pedidos, produtos), aviso, precisaReconectar };
}
