"use client";

import { useState } from "react";
import { CheckCircle2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { useLiveQuery } from "@/lib/hooks";
import {
  excluirPendencia,
  listarPendencias,
  reabrirPendencia,
  resolverPendencia,
} from "@/lib/services/pendencias";

const SITUACOES = ["Aberta", "Resolvida"];
const HEADERS = ["Pendência", "Cliente", "Tarefa vinculada", "Situação", "Ações"];

export default function PendenciasPage() {
  const [situacao, setSituacao] = useState("Aberta");
  const [cliente, setCliente] = useState("Todos");
  const { data: pendencias } = useLiveQuery(listarPendencias);

  const clientesComPendencia = [...new Set((pendencias ?? []).map((p) => p.cliente))];

  const filtradas = (pendencias ?? []).filter(
    (p) =>
      (situacao === "Todos" || (situacao === "Resolvida") === p.resolvida) &&
      (cliente === "Todos" || p.cliente === cliente)
  );

  async function excluir(id: string, descricao: string) {
    if (!window.confirm(`Excluir a pendência "${descricao}"?`)) return;
    await excluirPendencia(id);
  }

  return (
    <div>
      <PageHeader
        title="Pendências"
        description="Tudo que depende dos clientes para a operação andar."
        count={filtradas.length}
        countLabel="pendências"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Situação" value={situacao} options={SITUACOES} onChange={setSituacao} />
          <FilterSelect label="Cliente" value={cliente} options={clientesComPendencia} onChange={setCliente} />
        </div>
        <LinkButton href="/pendencias/nova">
          <Plus size={14} /> Nova pendência
        </LinkButton>
      </div>

      <Table headers={HEADERS}>
        {pendencias && filtradas.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem={
              situacao === "Aberta"
                ? "Nenhuma pendência aberta. 🎉"
                : "Nenhuma pendência encontrada."
            }
            acaoLabel="Criar pendência"
            acaoHref="/pendencias/nova"
          />
        )}
        {filtradas.map((p) => (
          <tr key={p.id} className="hover:bg-white/[0.02]">
            <TdMain>{p.descricao}</TdMain>
            <Td className="whitespace-nowrap">{p.cliente}</Td>
            <Td className="min-w-48 text-xs">{p.tarefa ?? "—"}</Td>
            <Td><Badge>{p.resolvida ? "Resolvida" : "Aberta"}</Badge></Td>
            <Td>
              <div className="flex gap-1.5">
                {p.resolvida ? (
                  <button
                    onClick={() => reabrirPendencia(p.id)}
                    title="Reabrir pendência"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-colors hover:border-amber-500/40 hover:bg-amber-500/10 hover:text-amber-400"
                  >
                    <RotateCcw size={13} />
                  </button>
                ) : (
                  <button
                    onClick={() => resolverPendencia(p.id)}
                    title="Marcar como resolvida"
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-zinc-500 transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-400"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                )}
                <button
                  onClick={() => excluir(p.id, p.descricao)}
                  title="Excluir pendência"
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
