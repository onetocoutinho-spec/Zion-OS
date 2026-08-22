"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { FiltroDeLoja } from "@/components/ui/FiltroDeLoja";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { RELATORIO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarRelatorios } from "@/lib/services/relatorios";

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
  const { lojaId } = useLojaAtual();
  const { data: relatorios } = useLiveQuery(listarRelatorios);

  const lojasComRelatorio = [...new Set((relatorios ?? []).map((r) => r.clienteId))];

  const filtrados = (relatorios ?? []).filter(
    (r) =>
      (status === "Todos" || r.status === status) &&
      (!lojaId || r.clienteId === lojaId)
  );

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Relatórios de período por cliente: o que foi feito e o que vem a seguir."
        count={filtrados.length}
        countLabel="relatórios"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FiltroDeLoja apenasIds={lojasComRelatorio} />
          <FilterSelect label="Status" value={status} options={RELATORIO_STATUS} onChange={setStatus} />
        </div>
        <LinkButton href="/relatorios/novo">
          <Plus size={14} /> Novo relatório
        </LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {filtrados.map((r) => (
          <Card
            key={r.id}
            title={`${r.cliente} — ${r.periodo}`}
            action={
              <div className="flex items-center gap-2">
                <Link
                  href={`/relatorios/${r.id}/editar`}
                  className="text-zinc-500 transition-colors hover:text-violet-300"
                  title="Editar relatório"
                >
                  <Pencil size={14} />
                </Link>
                <Badge>{r.status}</Badge>
              </div>
            }
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

      {relatorios && filtrados.length === 0 && (
        <EmptyState
          mensagem="Nenhum relatório criado ainda."
          acaoLabel="Criar relatório"
          acaoHref="/relatorios/novo"
        />
      )}
    </div>
  );
}
