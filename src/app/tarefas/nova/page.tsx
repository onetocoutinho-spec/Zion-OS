"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { TarefaForm } from "@/components/forms/TarefaForm";

function Conteudo() {
  const params = useSearchParams();
  return (
    <TarefaForm
      clientePadrao={params.get("cliente") ?? undefined}
      produtoPadrao={params.get("produto") ?? undefined}
      anuncioPadrao={params.get("anuncio") ?? undefined}
    />
  );
}

export default function NovaTarefaPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nova tarefa" description="Crie uma tarefa vinculada a um cliente da operação." />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
