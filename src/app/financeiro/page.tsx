"use client";

import { useState } from "react";
import { Wallet, TrendingUp, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { financeiro } from "@/lib/data/financeiro";
import { formatBRL, formatDate } from "@/lib/format";

const STATUS = ["Pago", "Pendente", "Atrasado"];

const HEADERS = [
  "Cliente",
  "Plano",
  "Valor mensal",
  "Vencimento",
  "Pagamento",
  "Serviços extras",
  "Custo operacional",
  "Lucro estimado",
  "Observações",
];

export default function FinanceiroPage() {
  const [status, setStatus] = useState("Todos");

  const filtrados = financeiro.filter(
    (f) => status === "Todos" || f.statusPagamento === status
  );

  const receita = financeiro.reduce((s, f) => s + f.valorMensal, 0);
  const lucro = financeiro.reduce((s, f) => s + f.lucroEstimado, 0);
  const atrasados = financeiro.filter((f) => f.statusPagamento === "Atrasado");
  const emAtraso = atrasados.reduce((s, f) => s + f.valorMensal, 0);

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Mensalidades, custos e lucro estimado por cliente."
        count={filtrados.length}
        countLabel="registros"
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Receita mensal prevista" value={formatBRL(receita)} icon={Wallet} tone="green" />
        <StatCard label="Lucro estimado" value={formatBRL(lucro)} icon={TrendingUp} tone="violet" />
        <StatCard
          label="Em atraso"
          value={formatBRL(emAtraso)}
          icon={AlertCircle}
          tone="red"
          hint={`${atrasados.length} cliente(s) em atraso`}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-4">
        <FilterSelect label="Pagamento" value={status} options={STATUS} onChange={setStatus} />
      </div>

      <Table headers={HEADERS}>
        {filtrados.length === 0 && <EmptyRow colSpan={HEADERS.length} />}
        {filtrados.map((f) => (
          <tr key={f.id} className="hover:bg-white/[0.02]">
            <TdMain>{f.cliente}</TdMain>
            <Td className="whitespace-nowrap">{f.plano}</Td>
            <Td className="whitespace-nowrap text-zinc-200">{formatBRL(f.valorMensal)}</Td>
            <Td className="whitespace-nowrap">{formatDate(f.dataVencimento)}</Td>
            <Td><Badge>{f.statusPagamento}</Badge></Td>
            <Td className="min-w-48 text-xs">{f.servicosExtras}</Td>
            <Td className="whitespace-nowrap">{formatBRL(f.custoOperacional)}</Td>
            <Td className="whitespace-nowrap font-medium text-emerald-400">
              {formatBRL(f.lucroEstimado)}
            </Td>
            <Td className="min-w-48 text-xs">{f.observacoes || "—"}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
