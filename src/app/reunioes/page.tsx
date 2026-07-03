"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { REUNIAO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import {
  alterarStatusReuniao,
  excluirReuniao,
  listarReunioes,
} from "@/lib/services/reunioes";
import { formatDateTime } from "@/lib/format";

const HEADERS = ["Reunião", "Cliente", "Data e hora", "Pauta", "Status", "Ações"];

export default function ReunioesPage() {
  const [status, setStatus] = useState("Todos");
  const [cliente, setCliente] = useState("Todos");
  const { data: reunioes } = useLiveQuery(listarReunioes);

  const clientesComReuniao = [...new Set((reunioes ?? []).map((r) => r.cliente))];

  const filtradas = (reunioes ?? []).filter(
    (r) =>
      (status === "Todos" || r.status === status) &&
      (cliente === "Todos" || r.cliente === cliente)
  );

  async function excluir(id: string, titulo: string) {
    if (!window.confirm(`Excluir a reunião "${titulo}"?`)) return;
    await excluirReuniao(id);
  }

  return (
    <div>
      <PageHeader
        title="Reuniões"
        description="Agenda de reuniões com os clientes da agência."
        count={filtradas.length}
        countLabel="reuniões"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Status" value={status} options={REUNIAO_STATUS} onChange={setStatus} />
          <FilterSelect label="Cliente" value={cliente} options={clientesComReuniao} onChange={setCliente} />
        </div>
        <LinkButton href="/reunioes/nova">
          <Plus size={14} /> Nova reunião
        </LinkButton>
      </div>

      <Table headers={HEADERS}>
        {reunioes && filtradas.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Nenhuma reunião encontrada."
            acaoLabel="Agendar reunião"
            acaoHref="/reunioes/nova"
          />
        )}
        {filtradas.map((r) => (
          <tr key={r.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3 align-top">
              <Link href={`/reunioes/${r.id}/editar`}>
                <p className="font-medium text-zinc-200 hover:text-violet-300">{r.titulo}</p>
              </Link>
            </td>
            <Td className="whitespace-nowrap">{r.cliente}</Td>
            <Td className="whitespace-nowrap">{formatDateTime(r.dataHora)}</Td>
            <Td className="min-w-56 text-xs">{r.pauta || "—"}</Td>
            <Td><Badge>{r.status}</Badge></Td>
            <Td>
              <div className="flex gap-1.5">
                {r.status === "Agendada" && (
                  <button
                    onClick={() => alterarStatusReuniao(r.id, "Realizada")}
                    title="Marcar como realizada"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                )}
                <Link
                  href={`/reunioes/${r.id}/editar`}
                  title="Editar reunião"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-colors hover:border-white/20 hover:text-zinc-200"
                >
                  <Pencil size={13} />
                </Link>
                <button
                  onClick={() => excluir(r.id, r.titulo)}
                  title="Excluir reunião"
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
