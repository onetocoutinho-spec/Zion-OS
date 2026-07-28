"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Search, Package, TrendingUp } from "lucide-react";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { MargemMinima } from "@/components/client-portal/MargemMinima";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { listarTodasVariantes } from "@/lib/services/produtoVariantes";
import { margemMinimaDoCliente } from "@/lib/services/margemCliente";
import { custosDoLojista } from "@/lib/services/custosCliente";
import { custosDoCliente, embalagemDasVariantes } from "@/lib/services/taxasDoCliente";
import { toneSaudeMargem } from "@/lib/client-portal/metrics";
import {
  custoDasTaxas,
  lucroLiquido,
  margemLiquida,
  precoMinimo,
  classificarMargem,
  MARGEM_MINIMA_PADRAO,
  TAXAS_PADRAO,
  type ModeloTaxas,
} from "@/modules/pricing/domain/modeloPreco";
import { formatBRL } from "@/lib/format";

const STATUS = ["Saudável", "Atenção", "Risco", "Prejuízo"] as const;

export default function ClientePrecificacao() {
  const { clienteId, marketplace } = useClientPortal();
  const { data: produtos } = useLiveQuery(listarProdutos);
  const { data: variantes } = useLiveQuery(listarTodasVariantes);

  const [fStatus, setFStatus] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [mostrarIdeal, setMostrarIdeal] = useState(false);
  // A margem que o LOJISTA escolheu. Enquanto não chega, o padrão vale — a tela
  // nunca fica sem piso, o que faria toda margem parecer saudável.
  const [margem, setMargem] = useState(MARGEM_MINIMA_PADRAO);
  // A REPUTAÇÃO do lojista, do próprio ML: é ela que decide qual das três
  // tabelas de custo de envio vale, e a diferença entre verde e laranja passa
  // de 90% no frete. Enquanto não chega, vale o padrão (verde, a regra do ML
  // para quem ainda não tem reputação).
  const [taxasBase, setTaxasBase] = useState<ModeloTaxas>(TAXAS_PADRAO);
  const [avisoCustos, setAvisoCustos] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    margemMinimaDoCliente().then((m) => vivo && setMargem(m));
    // Imposto, comissões internas e embalagem entram na MESMA conta. Sem eles a
    // margem saía otimista: 20,7% onde a planilha do lojista mostrava 6%.
    custosDoLojista().then((c) => vivo && setTaxasBase((t) => ({ ...t, custosDoLojista: c })));
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    // Sem categoria no pedido: aqui só a reputação interessa. A comissão exata
    // por categoria é consultada nas telas de UM produto, onde o lojista está
    // prestes a decidir um preço — uma chamada por linha desta tabela seria
    // uma tempestade de rede sem ganho proporcional.
    custosDoCliente({ clienteId, marketplace })
      .then((c) => {
        if (!vivo) return;
        setTaxasBase(c.taxas);
        setAvisoCustos(c.aviso);
      })
      .catch(() => vivo && setAvisoCustos("Não foi possível consultar sua reputação no ML."));
    return () => {
      vivo = false;
    };
  }, [clienteId, marketplace]);

  /** Peso e medidas por produto — vêm das variantes, não do produto pai. */
  const embalagemPorProduto = useMemo(() => {
    const porProduto = new Map<string, typeof variantes>();
    (variantes ?? []).forEach((v) => {
      if (!v.produtoId) return;
      const lista = porProduto.get(v.produtoId) ?? [];
      lista.push(v);
      porProduto.set(v.produtoId, lista);
    });
    const mapa = new Map<string, ReturnType<typeof embalagemDasVariantes>>();
    porProduto.forEach((lista, id) => mapa.set(id, embalagemDasVariantes(lista ?? [])));
    return mapa;
  }, [variantes]);

  const linhas = useMemo(() => {
    return (produtos ?? []).map((p) => {
      const taxasDoProduto: ModeloTaxas = {
        ...taxasBase,
        embalagem: embalagemPorProduto.get(p.id) ?? null,
      };
      // Cada um destes pode ser null quando falta o peso da embalagem — a
      // coluna mostra a pendência em vez de um número inventado.
      const taxas = custoDasTaxas(p.precoVenda, taxasDoProduto);
      const lucro = lucroLiquido(p.custo, p.precoVenda, taxasDoProduto);
      const temDados = p.precoVenda > 0 && p.custo > 0;
      const pct = temDados ? margemLiquida(p.custo, p.precoVenda, taxasDoProduto) : null;
      const status = classificarMargem(pct, margem);
      const saude = { margem: pct, status, tone: toneSaudeMargem(status) };
      const piso = p.custo > 0 ? precoMinimo(p.custo, margem, taxasDoProduto) : null;
      const precoIdeal = piso?.ok ? piso.preco : null;
      const pendencia = piso && !piso.ok && piso.motivo === "sem_peso" ? piso.pendencia : null;
      return { p, taxas, lucro, saude, precoIdeal, pendencia };
    });
  }, [produtos, margem, taxasBase, embalagemPorProduto]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (fStatus !== "Todos" && l.saude.status !== fStatus) return false;
      if (mostrarIdeal && !(l.precoIdeal != null && l.p.precoVenda < l.precoIdeal)) return false;
      if (q && !`${l.p.nome} ${l.p.sku}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [linhas, fStatus, busca, mostrarIdeal]);

  const resumo = useMemo(() => {
    const cont = { Saudável: 0, Atenção: 0, Risco: 0, Prejuízo: 0 } as Record<string, number>;
    linhas.forEach((l) => {
      if (l.saude.status in cont) cont[l.saude.status] += 1;
    });
    return cont;
  }, [linhas]);

  const total = (produtos ?? []).length;

  if (total === 0) {
    return (
      <>
        <PageHeader titulo="Precificação" subtitulo="Veja o lucro real e o preço ideal de cada produto." />
        <VazioAmigavel
          icon={Package}
          titulo="Sem produtos para precificar"
          descricao="Importe sua base para calcular margem, lucro e preço ideal de cada item."
          acao={
            <Link href="/cliente/produtos">
              <Button>Importar produtos</Button>
            </Link>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Precificação"
        subtitulo="Lucro real por produto pelo modelo Zion. Veja onde a margem está saudável — ou em risco."
        acao={
          <Button variant={mostrarIdeal ? "primary" : "ghost"} onClick={() => setMostrarIdeal((v) => !v)}>
            <TrendingUp size={15} /> {mostrarIdeal ? "Ver todos" : "Calcular preço ideal"}
          </Button>
        }
      />

      <MargemMinima margem={margem} onMudou={setMargem} />

      {avisoCustos && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300">
          {avisoCustos} Os números abaixo usam a tabela padrão até o Mercado Livre responder.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Saudável" value={resumo["Saudável"]} icon={Calculator} tone="green" />
        <StatCard label="Atenção" value={resumo["Atenção"]} icon={Calculator} tone="yellow" />
        <StatCard label="Risco" value={resumo["Risco"]} icon={Calculator} tone="orange" />
        <StatCard label="Prejuízo" value={resumo["Prejuízo"]} icon={Calculator} tone="red" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-zinc-500 focus-within:border-violet-500/50">
          <Search size={14} />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto…"
            className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-500"
          />
        </div>
        <FilterSelect label="Status" value={fStatus} options={STATUS} onChange={setFStatus} />
        <span className="ml-auto text-xs text-zinc-500">
          {filtradas.length} de {total} produtos
        </span>
      </div>

      <Table
        headers={["Produto", "Custo", "Preço", "Taxas", "Lucro", "Margem", "Preço ideal", "Status"]}
      >
        {filtradas.length === 0 ? (
          <EmptyRow colSpan={8} />
        ) : (
          filtradas.map(({ p, taxas, lucro, saude, precoIdeal, pendencia }) => (
            <tr key={p.id} className="hover:bg-white/[0.02]">
              <TdMain sub={p.sku || undefined}>{p.nome}</TdMain>
              <Td>{formatBRL(p.custo)}</Td>
              <Td>{formatBRL(p.precoVenda)}</Td>
              <Td className="text-zinc-500">{taxas === null ? "—" : formatBRL(taxas)}</Td>
              <Td className={lucro !== null && lucro < 0 ? "text-red-400" : "text-emerald-400"}>
                {lucro === null ? <span className="text-zinc-600">—</span> : formatBRL(lucro)}
              </Td>
              <Td>{saude.margem != null ? `${saude.margem}%` : "—"}</Td>
              <Td>
                {precoIdeal != null ? (
                  <span className={p.precoVenda < precoIdeal ? "text-amber-400" : "text-zinc-400"}>
                    {formatBRL(precoIdeal)}
                  </span>
                ) : pendencia ? (
                  <span className="text-[11px] text-amber-400/80" title={pendencia}>
                    falta frete
                  </span>
                ) : (
                  <span className="text-zinc-600">—</span>
                )}
              </Td>
              <Td>
                <Pill tone={saude.tone}>{saude.status}</Pill>
              </Td>
            </tr>
          ))
        )}
      </Table>

      <p className="text-xs leading-relaxed text-zinc-500">
        <span className="text-amber-400">Preço ideal</span> = o menor preço que ainda entrega a sua
        margem de {margem}%, já descontadas as taxas. Preços atuais abaixo desse valor aparecem em
        amarelo. Mude a margem acima e a coluna inteira se recalcula.
        <br />
        O custo de envio vem da tabela oficial do Mercado Livre, pela{" "}
        <span className="text-zinc-400">sua reputação</span> e pelo peso cobrável de cada produto —
        o maior entre o peso real e o cubado. Onde falta a medida da embalagem, o preço ideal
        aparece como pendência em vez de estimativa.
      </p>
    </>
  );
}
