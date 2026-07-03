"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { ReuniaoForm } from "@/components/forms/ReuniaoForm";

function Conteudo() {
  const params = useSearchParams();
  return <ReuniaoForm clientePadrao={params.get("cliente") ?? undefined} />;
}

export default function NovaReuniaoPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Nova reunião" description="Agende uma reunião com um cliente." />
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
