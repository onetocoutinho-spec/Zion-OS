"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Percent,
  Package,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FiltroDeLoja } from "@/components/ui/FiltroDeLoja";
import { useLiveQuery } from "@/lib/hooks";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { listarProdutos } from "@/lib/services/produtos";
import { buscarVendasDoCliente, calcularMetricas } from "@/lib/services/vendasML";
import { formatBRL } from "@/lib/format";
import type { PedidoML } from "@/lib/marketplaces/mercadolivre";


const PERIODOS = [7, 30, 90];

export default function VendasEquipe() {
  const { data: produtos } = useLiveQuery(listarProdutos);

  // A loja vem do contexto global. Antes esta tela auto-selecionava a PRIMEIRA
  // loja da lista: um F5 na Loja B mostrava as vendas da Loja A sem avisar.
  const { lojaId } = useLojaAtual();
  const clienteId = lojaId ?? "";
  const [dias, setDias] = useState(30);
  const [pedidos, setPedidos] = useState<PedidoML[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function carregar() {
    if (!clienteId || carregando) return;
    setCarregando(true);
    setAviso(null);
    setPedidos([]);
    try {
      const r = await buscarVendasDoCliente(clienteId, { dias });
      setPedidos(r.pedidos);
      setAviso(r.aviso ?? null);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Falha ao buscar vendas.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (clienteId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, dias]);

  const produtosDoCliente = useMemo(
    () => (produtos ?? []).filter((p) => p.clienteId === clienteId),
    [produtos, clienteId]
  );
  const m = useMemo(() => calcularMetricas(pedidos, produtosDoCliente), [pedidos, produtosDoCliente]);
  const maxDia = Math.max(1, ...m.porDia.map((d) => d.faturamento));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Vendas" description="Faturamento e lucro líquido por cliente, com dados reais do Mercado Livre." />
        <div className="flex flex-wrap items-center gap-2">
          <FiltroDeLoja obrigatorio />
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs">
            {PERIODOS.map((d) => (
              <button
                key={d}
                onClick={() => setDias(d)}
                className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                  dias === d ? "bg-violet-500/15 text-violet-300" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="ghost" onClick={carregar} disabled={carregando}>
            <RefreshCw size={15} className={carregando ? "animate-spin" : ""} /> Atualizar
          </Button>
        </div>
      </div>

      {!clienteId && (
        <EmptyState mensagem="Escolha a loja para ver o faturamento e o lucro dela no Mercado Livre." />
      )}

      {clienteId && aviso && (
        <p className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
          <AlertTriangle size={15} /> {aviso}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Faturamento" value={formatBRL(m.faturamento)} icon={DollarSign} tone="green" hint={`${dias} dias`} />
        <StatCard label="Lucro líquido" value={formatBRL(m.lucroLiquido)} icon={TrendingUp} tone={m.lucroLiquido >= 0 ? "green" : "red"} hint={`margem ${m.margem}%`} />
        <StatCard label="Pedidos" value={m.pedidos} icon={ShoppingCart} tone="violet" />
        <StatCard label="Ticket médio" value={formatBRL(m.ticketMedio)} icon={Receipt} tone="blue" />
        <StatCard label="Taxas ML" value={formatBRL(m.taxas)} icon={Percent} tone="orange" />
        <StatCard label="Custo" value={formatBRL(m.custo)} icon={Package} tone="cyan" hint={`${m.coberturaCusto}% c/ custo`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Faturamento por dia">
          {m.porDia.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{carregando ? "Carregando…" : "Sem vendas no período."}</p>
          ) : (
            <div className="flex h-40 items-end gap-1">
              {m.porDia.map((d) => (
                <div key={d.dia} className="flex flex-1 flex-col items-center justify-end" title={`${d.dia}: ${formatBRL(d.faturamento)}`}>
                  <div className="w-full rounded-t bg-gradient-to-t from-violet-600/60 to-violet-400" style={{ height: `${Math.max(4, (d.faturamento / maxDia) * 100)}%` }} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Mais vendidos">
          {m.topProdutos.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">{carregando ? "Carregando…" : "Sem dados."}</p>
          ) : (
            <ul className="space-y-2.5">
              {m.topProdutos.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="truncate text-sm text-zinc-300">{i + 1}. {p.titulo}</span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="gray">{`${p.unidades} un`}</Badge>
                    <span className="text-sm font-medium text-zinc-200">{formatBRL(p.faturamento)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
