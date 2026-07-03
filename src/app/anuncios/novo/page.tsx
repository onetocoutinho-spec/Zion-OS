"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { AnuncioForm } from "@/components/forms/AnuncioForm";

function Conteudo() {
  const params = useSearchParams();
  return (
    <AnuncioForm
      clientePadrao={params.get("cliente") ?? undefined}
      produtoPadrao={params.get("produto") ?? undefined}
    />
  );
}

export default function NovoAnuncioPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo anúncio" description="Adicione um anúncio à esteira de otimização." />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
