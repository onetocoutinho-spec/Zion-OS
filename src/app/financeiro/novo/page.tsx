"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { FinanceiroForm } from "@/components/forms/FinanceiroForm";

function Conteudo() {
  const params = useSearchParams();
  return <FinanceiroForm clientePadrao={params.get("cliente") ?? undefined} />;
}

export default function NovoRegistroFinanceiroPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo registro financeiro" description="Cadastre a mensalidade ou cobrança de um cliente." />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
