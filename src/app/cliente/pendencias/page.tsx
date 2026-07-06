"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListChecks, CheckCircle2, Clock } from "lucide-react";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarPendenciasDoCliente } from "@/lib/services/pendencias";
import type { Pendencia } from "@/lib/types";

const STATUS = ["Pendente", "Resolvido"] as const;

function statusDe(p: Pendencia) {
  return p.resolvida ? "Resolvido" : "Pendente";
}

export default function ClientePendencias() {
  const { clienteId } = useClientPortal();
  const { data: pendencias } = useLiveQuery(
    () => listarPendenciasDoCliente(clienteId),
    [clienteId]
  );

  const [fStatus, setFStatus] = useState("Todos");

  const lista = pendencias ?? [];
  const abertas = lista.filter((p) => !p.resolvida).length;
  const resolvidas = lista.filter((p) => p.resolvida).length;

  const filtradas = useMemo(
    () => lista.filter((p) => fStatus === "Todos" || statusDe(p) === fStatus),
    [lista, fStatus]
  );

  return (
    <>
      <PageHeader
        titulo="Pendências"
        subtitulo="Itens que dependem de você ou da equipe Zion para avançar."
      />

      {lista.length === 0 ? (
        <VazioAmigavel
          icon={CheckCircle2}
          titulo="Nenhuma pendência 🎉"
          descricao="Você está em dia! Quando houver algo dependendo de você ou da Zion, aparece aqui."
          acao={
            <Link href="/cliente" className="text-sm text-violet-400 hover:text-violet-300">
              Voltar ao início →
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Abertas" value={abertas} icon={Clock} tone={abertas ? "yellow" : "gray"} />
            <StatCard label="Resolvidas" value={resolvidas} icon={CheckCircle2} tone="green" />
            <StatCard label="Total" value={lista.length} icon={ListChecks} tone="violet" />
          </div>

          <div className="flex items-center gap-3">
            <FilterSelect label="Status" value={fStatus} options={STATUS} onChange={setFStatus} />
            <span className="ml-auto text-xs text-zinc-500">
              {filtradas.length} de {lista.length}
            </span>
          </div>

          <Table headers={["Pendência", "Origem", "Status", "Ação"]}>
            {filtradas.length === 0 ? (
              <EmptyRow colSpan={4} />
            ) : (
              filtradas.map((p) => (
                <tr key={p.id} className="hover:bg-white/[0.02]">
                  <TdMain>{p.descricao}</TdMain>
                  <Td>{p.tarefa || "Geral"}</Td>
                  <Td>
                    <Pill tone={p.resolvida ? "green" : "yellow"}>{statusDe(p)}</Pill>
                  </Td>
                  <Td>
                    {p.resolvida ? (
                      <span className="text-zinc-600">—</span>
                    ) : (
                      <span className="text-xs text-zinc-500">Em acompanhamento pela Zion</span>
                    )}
                  </Td>
                </tr>
              ))
            )}
          </Table>
        </>
      )}
    </>
  );
}
