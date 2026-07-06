"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Calculator, Search, Package, TrendingUp } from "lucide-react";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { precoMinimoZion } from "@/lib/services/importacaoProdutos";
import { saudeMargem } from "@/lib/client-portal/metrics";
import { formatBRL } from "@/lib/format";

const STATUS = ["Saudável", "Atenção", "Risco", "Prejuízo"] as const;

/** Taxas do modelo Zion: comissão 30% + tarifa fixa 1,15 + frete estimado. */
function taxasZion(preco: number) {
  if (preco <= 0) return 0;
  const frete = preco >= 79 ? 14.15 : 0;
  return Math.round((preco * 0.3 + 1.15 + frete) * 100) / 100;
}

export default function ClientePrecificacao() {
  const { clienteId } = useClientPortal();
  const { data: produtos } = useLiveQuery(listarProdutos);

  const [fStatus, setFStatus] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [mostrarIdeal, setMostrarIdeal] = useState(false);

  const linhas = useMemo(() => {
    return (produtos ?? []).map((p) => {
      const taxas = taxasZion(p.precoVenda);
      const lucro = Math.round((p.precoVenda - p.custo - taxas) * 100) / 100;
      const saude = saudeMargem(p);
      const precoIdeal = p.custo > 0 ? precoMinimoZion(p.custo) : null;
      return { p, taxas, lucro, saude, precoIdeal };
    });
  }, [produtos]);

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
          filtradas.map(({ p, taxas, lucro, saude, precoIdeal }) => (
            <tr key={p.id} className="hover:bg-white/[0.02]">
              <TdMain sub={p.sku || undefined}>{p.nome}</TdMain>
              <Td>{formatBRL(p.custo)}</Td>
              <Td>{formatBRL(p.precoVenda)}</Td>
              <Td className="text-zinc-500">{formatBRL(taxas)}</Td>
              <Td className={lucro < 0 ? "text-red-400" : "text-emerald-400"}>{formatBRL(lucro)}</Td>
              <Td>{saude.margem != null ? `${saude.margem}%` : "—"}</Td>
              <Td>
                {precoIdeal != null ? (
                  <span className={p.precoVenda < precoIdeal ? "text-amber-400" : "text-zinc-400"}>
                    {formatBRL(precoIdeal)}
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

      <p className="text-xs text-zinc-500">
        <span className="text-amber-400">Preço ideal</span> = piso Zion para manter a margem mínima
        (custo + tarifas ÷ 0,65). Preços atuais abaixo desse valor aparecem em amarelo.
      </p>
    </>
  );
}
