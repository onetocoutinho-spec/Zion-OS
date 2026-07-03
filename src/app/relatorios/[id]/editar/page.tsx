"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { RelatorioForm } from "@/components/forms/RelatorioForm";
import { useLiveQuery } from "@/lib/hooks";
import { buscarRelatorio } from "@/lib/services/relatorios";

export default function EditarRelatorioPage() {
  const { id } = useParams<{ id: string }>();
  const { data: relatorio, carregando } = useLiveQuery(() => buscarRelatorio(id), [id]);

  if (carregando) return null;
  if (!relatorio)
    return <EmptyState mensagem="Relatório não encontrado." acaoLabel="Voltar para relatórios" acaoHref="/relatorios" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={`Editar relatório — ${relatorio.cliente}`}
        description={`Período: ${relatorio.periodo}`}
      />
      <RelatorioForm inicial={relatorio} />
    </div>
  );
}
