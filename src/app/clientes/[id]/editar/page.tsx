"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ClienteForm } from "@/components/forms/ClienteForm";
import { useLiveQuery } from "@/lib/hooks";
import { buscarCliente } from "@/lib/services/clientes";

export default function EditarClientePage() {
  const { id } = useParams<{ id: string }>();
  const { data: cliente, carregando } = useLiveQuery(() => buscarCliente(id), [id]);

  if (carregando) return null;
  if (!cliente)
    return <EmptyState mensagem="Cliente não encontrado." acaoLabel="Voltar para clientes" acaoHref="/clientes" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Editar ${cliente.empresa}`} description="Atualize os dados do cliente." />
      <ClienteForm inicial={cliente} />
    </div>
  );
}
