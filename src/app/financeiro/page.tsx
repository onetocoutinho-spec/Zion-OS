"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Plus, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { PAGAMENTO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import {
  listarFinanceiro,
  marcarComoAtrasado,
  marcarComoPago,
} from "@/lib/services/financeiro";
import { formatBRL, formatDate } from "@/lib/format";

const HEADERS = [
  "Cliente",
  "Plano",
  "Valor mensal",
  "Vencimento",
  "Pagamento",
  "Serviços extras",
  "Custo operacional",
  "Lucro estimado",
  "Ações",
];

export default function FinanceiroPage() {
  const [status, setStatus] = useState("Todos");
  const { data: financeiro } = useLiveQuery(listarFinanceiro);

  const registros = financeiro ?? [];
  const filtrados = registros.filter(
    (f) => status === "Todos" || f.statusPagamento === status
  );

  const receita = registros.reduce((s, f) => s + f.valorMensal, 0);
  const lucro = registros.reduce((s, f) => s + f.lucroEstimado, 0);
  const atrasados = registros.filter((f) => f.statusPagamento === "Atrasado");
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

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <FilterSelect label="Pagamento" value={status} options={PAGAMENTO_STATUS} onChange={setStatus} />
        <LinkButton href="/financeiro/novo">
          <Plus size={14} /> Novo registro
        </LinkButton>
      </div>

      <Table headers={HEADERS}>
        {financeiro && filtrados.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Nenhum registro financeiro encontrado."
            acaoLabel="Criar registro"
            acaoHref="/financeiro/novo"
          />
        )}
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
            <Td>
              <div className="flex gap-1.5">
                {f.statusPagamento !== "Pago" && (
                  <button
                    onClick={() => marcarComoPago(f.id)}
                    title="Marcar como pago"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                )}
                {f.statusPagamento === "Pendente" && (
                  <button
                    onClick={() => marcarComoAtrasado(f.id)}
                    title="Marcar como atrasado"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                  >
                    <AlertCircle size={14} />
                  </button>
                )}
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
