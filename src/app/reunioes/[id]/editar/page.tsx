"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ReuniaoForm } from "@/components/forms/ReuniaoForm";
import { useLiveQuery } from "@/lib/hooks";
import { buscarReuniao } from "@/lib/services/reunioes";

export default function EditarReuniaoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: reuniao, carregando } = useLiveQuery(() => buscarReuniao(id), [id]);

  if (carregando) return null;
  if (!reuniao)
    return <EmptyState mensagem="Reunião não encontrada." acaoLabel="Voltar para reuniões" acaoHref="/reunioes" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Editar ${reuniao.titulo}`} description={reuniao.cliente} />
      <ReuniaoForm inicial={reuniao} />
    </div>
  );
}
