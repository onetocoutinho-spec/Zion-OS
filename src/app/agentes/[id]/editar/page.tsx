"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AgenteForm } from "@/components/forms/AgenteForm";
import { useLiveQuery } from "@/lib/hooks";
import { buscarAgente } from "@/lib/services/agentes";

export default function EditarAgentePage() {
  const { id } = useParams<{ id: string }>();
  const { data: agente, carregando } = useLiveQuery(() => buscarAgente(id), [id]);

  if (carregando) return null;
  if (!agente)
    return <EmptyState mensagem="Agente não encontrado." acaoLabel="Voltar para agentes" acaoHref="/agentes" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Editar ${agente.nome}`} description="Atualize a definição do agente." />
      <AgenteForm inicial={agente} />
    </div>
  );
}
