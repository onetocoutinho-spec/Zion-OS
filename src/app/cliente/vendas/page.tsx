"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  ShoppingCart,
  Receipt,
  Package,
  Percent,
  RefreshCw,
  AlertTriangle,
  Plug,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { toneSaudeMargem } from "@/lib/client-portal/metrics";
import { margemMinimaComOrigem } from "@/lib/services/margemCliente";
import { classificarMargem, MARGEM_MINIMA_PADRAO } from "@/modules/pricing/domain/modeloPreco";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { buscarVendasDoCliente, calcularMetricas } from "@/lib/services/vendasML";
import { formatBRL } from "@/lib/format";
import type { PedidoML } from "@/lib/marketplaces/mercadolivre";

const PERIODOS = [
  { dias: 7, label: "7 dias" },
  { dias: 30, label: "30 dias" },
  { dias: 90, label: "90 dias" },
];

export default function ClienteVendas() {
  const { clienteId } = useClientPortal();
  const { data: produtos } = useLiveQuery(listarProdutos);

  const [dias, setDias] = useState(30);
  const [pedidos, setPedidos] = useState<PedidoML[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  /** O ML recusou a credencial: nada abaixo pôde ser lido. */
  const [precisaReconectar, setPrecisaReconectar] = useState(false);
  /** O canal nunca foi ligado — outro estado, outra saída. */
  const [precisaConectar, setPrecisaConectar] = useState(false);
  const [carregouUmaVez, setCarregouUmaVez] = useState(false);

  async function carregar() {
    if (!clienteId || carregando) return;
    setCarregando(true);
    setPrecisaReconectar(false);
    setPrecisaConectar(false);
    setAviso(null);
    try {
      const r = await buscarVendasDoCliente(clienteId, { dias });
      setPedidos(r.pedidos);
      setAviso(r.aviso ?? null);
      setPrecisaReconectar(Boolean(r.precisaReconectar));
      setPrecisaConectar(Boolean(r.precisaConectar));
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Falha ao buscar vendas.");
    } finally {
      setCarregando(false);
      setCarregouUmaVez(true);
    }
  }

  useEffect(() => {
    if (clienteId) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, dias]);

  const m = useMemo(() => calcularMetricas(pedidos, produtos ?? []), [pedidos, produtos]);

  // O PISO DELA — a mesma fonte da tela de Precificação. Sem isto, a cor da
  // margem sairia de um número escrito nesta página (AUD-002).
  const [margem, setMargem] = useState(MARGEM_MINIMA_PADRAO);
  useEffect(() => {
    let vivo = true;
    margemMinimaComOrigem().then((r) => vivo && setMargem(r.margem));
    return () => {
      vivo = false;
    };
  }, []);

  /**
   * O lucro é PARCIAL quando nem todo item vendido tem custo cadastrado.
   *
   * `lucroLiquido = faturamento - taxas - custo`, e `custo` só soma o que
   * existe na base — então cobertura abaixo de 100% produz lucro
   * SUPERESTIMADO por construção, nunca subestimado. Medido em 03/08/2026:
   * 30 de 80 produtos têm custo.
   */
  const parcial = m.coberturaCusto < 100 && m.pedidos > 0;
  const maxDia = Math.max(1, ...m.porDia.map((d) => d.faturamento));
  // ESTE ESTADO SAIU DA PROSA. Era duas buscas de texto no aviso, com e sem
  // acento, porque ninguém sabia qual chegaria — o sintoma de decidir
  // comportamento pela REDAÇÃO de uma frase. Agora vem do serviço, como fato.
  const naoConectado = precisaConectar;

  return (
    <>
      <PageHeader
        titulo="Vendas"
        subtitulo="Faturamento, lucro e pedidos da sua loja no Mercado Livre."
        acao={
          /* `flex-wrap` — sem ele os quatro botões não quebram, empurram a
              largura e deslocam a PÁGINA inteira. Visto num print da conta real
              em 06/08/2026: o conteúdo aparecia cortado à esquerda e o título
              fora da tela. O `PageHeader` já quebrava linha; era este grupo de
              dentro que não. */
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs">
              {PERIODOS.map((p) => (
                <button
                  key={p.dias}
                  onClick={() => setDias(p.dias)}
                  className={`rounded-md px-2.5 py-1.5 font-medium transition-colors [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:px-4 ${
                    dias === p.dias ? "bg-violet-500/15 text-violet-300" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button variant="ghost" onClick={carregar} disabled={carregando}>
              <RefreshCw size={15} className={carregando ? "animate-spin" : ""} /> Atualizar
            </Button>
          </div>
        }
      />

      {/* TRÊS ESTADOS, TRÊS DESENHOS — e o do meio não existia.
        *
        * "nunca conectou" e "conectado e lendo" estavam modelados; "conectado,
        * mas o ML recusou a credencial" caía no segundo e desenhava a loja
        * inteira zerada: sete cartões de R$ 0 em cima de uma lista que ninguém
        * conseguiu ler. Vazio ali significa "não consegui perguntar", nunca
        * "ela não vendeu" — a ausência virando afirmação, agora sobre o
        * faturamento dela.
        *
        * A saída é outra, também: ali é conectar pela primeira vez, aqui é
        * REFAZER uma conexão que existe. */}
      {precisaReconectar ? (
        <VazioAmigavel
          icon={Plug}
          titulo="Refaça a conexão com o Mercado Livre"
          descricao="Sua conta está ligada, mas o Mercado Livre não aceitou mais a autorização salva — costuma acontecer quando a senha muda ou a permissão é revogada por lá. Nada foi perdido: é só autorizar de novo."
          acao={
            <Link href="/cliente/conectar-ml">
              <Button>
                <Plug size={15} /> Reconectar agora
              </Button>
            </Link>
          }
        />
      ) : naoConectado ? (
        <VazioAmigavel
          icon={Plug}
          titulo="Conecte sua conta do Mercado Livre"
          descricao="Para ver suas vendas, faturamento e lucro, ligue sua conta do ML. É rápido e seguro."
          acao={
            <Link href="/cliente/conectar-ml">
              <Button>
                <Plug size={15} /> Conectar Mercado Livre
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {aviso && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
              <AlertTriangle size={15} /> {aviso}
            </p>
          )}

          {/* Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Faturamento" value={formatBRL(m.faturamento)} icon={DollarSign} tone="green" hint={`${dias} dias`} />
            {/* PARCIAL É DITO NO RÓTULO, não só num rodapé.
                `lucroLiquido = faturamento - taxas - custo`, e `custo` só soma
                os itens cujo custo existe na base. Com cobertura abaixo de
                100%, este número está SUPERESTIMADO por construção — medido em
                03/08/2026: 30 de 80 produtos têm custo. O rodapé já avisava,
                mas rótulo verde vence rodapé cinza. */}
            <StatCard
              label={parcial ? "Lucro líquido (parcial)" : "Lucro líquido"}
              value={formatBRL(m.lucroLiquido)}
              icon={TrendingUp}
              tone={parcial ? "yellow" : m.lucroLiquido >= 0 ? "green" : "red"}
              hint={
                parcial
                  ? `superestimado — só ${m.coberturaCusto}% dos itens têm custo`
                  : `margem ${m.margem}%`
              }
            />
            <StatCard label="Pedidos" value={m.pedidos} icon={ShoppingCart} tone="violet" hint={`${m.unidades} unidades`} />
            <StatCard label="Ticket médio" value={formatBRL(m.ticketMedio)} icon={Receipt} tone="blue" />
            <StatCard label="Taxas do ML" value={formatBRL(m.taxas)} icon={Percent} tone="orange" />
            <StatCard label="Custo dos produtos" value={formatBRL(m.custo)} icon={Package} tone="cyan" hint={`${m.coberturaCusto}% dos itens c/ custo`} />
            <StatCard label="Unidades vendidas" value={m.unidades} icon={Package} tone="gray" />
            {/* A COR SAI DO PISO DELA, não de um 20 escrito aqui.
                Havia um terceiro limiar de margem no repositório — `>= 20` era
                verde — desligado do piso que a lojista escolheu e da regra que
                a tela de Precificação usa. Três réguas para a mesma pergunta é
                como dois modelos de comissão conviveram meses (AUD-001). */}
            <StatCard
              label={parcial ? "Margem (parcial)" : "Margem"}
              value={`${m.margem}%`}
              icon={Percent}
              tone={parcial ? "yellow" : toneSaudeMargem(classificarMargem(m.margem, margem))}
              hint={parcial ? undefined : `seu piso: ${margem}%`}
            />
          </div>

          {m.coberturaCusto < 100 && m.pedidos > 0 && (
            <p className="text-xs text-zinc-500">
              💡 O lucro usa o custo dos produtos que a gente tem cadastrado ({m.coberturaCusto}% dos itens vendidos).
              Importe/atualize os custos em <Link href="/cliente/produtos" className="text-violet-400 hover:text-violet-300">Meus Produtos</Link> para o cálculo ficar 100%.
            </p>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Gráfico faturamento por dia */}
            <Card title="Faturamento por dia">
              {m.porDia.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  {carregando ? "Carregando vendas…" : carregouUmaVez ? "Nenhuma venda no período." : "—"}
                </p>
              ) : (
                <div className="flex h-40 items-end gap-1">
                  {m.porDia.map((d) => (
                    <div key={d.dia} className="group flex flex-1 flex-col items-center justify-end" title={`${d.dia}: ${formatBRL(d.faturamento)}`}>
                      <div
                        className="w-full rounded-t bg-gradient-to-t from-violet-600/60 to-violet-400 transition-all group-hover:from-violet-500 group-hover:to-fuchsia-400"
                        style={{ height: `${Math.max(4, (d.faturamento / maxDia) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
              )}
              {m.porDia.length > 0 && (
                <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
                  <span>{m.porDia[0]?.dia.slice(5)}</span>
                  <span>{m.porDia[m.porDia.length - 1]?.dia.slice(5)}</span>
                </div>
              )}
            </Card>

            {/* Top produtos */}
            <Card title="Mais vendidos">
              {m.topProdutos.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">
                  {carregando ? "Carregando…" : "Sem dados no período."}
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {m.topProdutos.map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-[11px] font-semibold text-zinc-400">
                          {i + 1}
                        </span>
                        <span className="truncate text-sm text-zinc-300">{p.titulo}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Pill tone="gray">{p.unidades} un</Pill>
                        <span className="text-sm font-medium text-zinc-200">{formatBRL(p.faturamento)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
