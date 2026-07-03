"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProdutoForm } from "@/components/forms/ProdutoForm";

function Conteudo() {
  const params = useSearchParams();
  return <ProdutoForm clientePadrao={params.get("cliente") ?? undefined} />;
}

export default function NovoProdutoPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Novo produto" description="Adicione um produto à base de um cliente." />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
