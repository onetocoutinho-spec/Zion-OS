"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { PendenciaForm } from "@/components/forms/PendenciaForm";

function Conteudo() {
  const params = useSearchParams();
  return <PendenciaForm clientePadrao={params.get("cliente") ?? undefined} />;
}

export default function NovaPendenciaPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nova pendência" description="Registre algo que depende do cliente." />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
