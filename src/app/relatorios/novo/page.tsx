"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { RelatorioForm } from "@/components/forms/RelatorioForm";

function Conteudo() {
  const params = useSearchParams();
  return <RelatorioForm clientePadrao={params.get("cliente") ?? undefined} />;
}

export default function NovoRelatorioPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo relatório" description="Documente o período trabalhado de um cliente." />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
