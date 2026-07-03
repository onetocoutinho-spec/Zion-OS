"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { TarefaForm } from "@/components/forms/TarefaForm";
import { useLiveQuery } from "@/lib/hooks";
import { buscarTarefa } from "@/lib/services/tarefas";

export default function EditarTarefaPage() {
  const { id } = useParams<{ id: string }>();
  const { data: tarefa, carregando } = useLiveQuery(() => buscarTarefa(id), [id]);

  if (carregando) return null;
  if (!tarefa)
    return <EmptyState mensagem="Tarefa não encontrada." acaoLabel="Voltar para tarefas" acaoHref="/tarefas" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Editar tarefa" description={tarefa.tarefa} />
      <TarefaForm inicial={tarefa} />
    </div>
  );
}
