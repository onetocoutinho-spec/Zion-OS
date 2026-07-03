"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { relatorios } from "@/lib/data/relatorios";

const STATUS = ["Pendente", "Em elaboração", "Enviado", "Aprovado"];
const CLIENTES = [...new Set(relatorios.map((r) => r.cliente))];

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

export default function RelatoriosPage() {
  const [status, setStatus] = useState("Todos");
  const [cliente, setCliente] = useState("Todos");

  const filtrados = relatorios.filter(
    (r) =>
      (status === "Todos" || r.status === status) &&
      (cliente === "Todos" || r.cliente === cliente)
  );

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Relatórios de período por cliente: o que foi feito e o que vem a seguir."
        count={filtrados.length}
        countLabel="relatórios"
      />

      <div className="mb-4 flex flex-wrap gap-4">
        <FilterSelect label="Cliente" value={cliente} options={CLIENTES} onChange={setCliente} />
        <FilterSelect label="Status" value={status} options={STATUS} onChange={setStatus} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {filtrados.map((r) => (
          <Card
            key={r.id}
            title={`${r.cliente} — ${r.periodo}`}
            action={<Badge>{r.status}</Badge>}
          >
            <div className="mb-4 flex gap-3">
              <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                <p className="text-lg font-semibold text-white">{r.produtosTrabalhados}</p>
                <p className="text-[11px] text-zinc-500">produtos trabalhados</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] px-3 py-2 text-center">
                <p className="text-lg font-semibold text-white">{r.anunciosRevisados}</p>
                <p className="text-[11px] text-zinc-500">anúncios revisados</p>
              </div>
            </div>

            <div className="space-y-3">
              <Campo label="O que foi feito">{r.oQueFoiFeito}</Campo>
              <Campo label="Problemas encontrados">{r.problemasEncontrados}</Campo>
              <Campo label="Oportunidades">{r.oportunidades}</Campo>
              <Campo label="Pendências">{r.pendencias}</Campo>
              <Campo label="Próximas ações">{r.proximasAcoes}</Campo>
            </div>
          </Card>
        ))}
      </div>

      {filtrados.length === 0 && (
        <p className="py-10 text-center text-sm text-zinc-500">
          Nenhum relatório encontrado com os filtros atuais.
        </p>
      )}
    </div>
  );
}
