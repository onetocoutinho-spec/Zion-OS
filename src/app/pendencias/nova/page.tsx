"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { PendenciaForm } from "@/components/forms/PendenciaForm";

function Conteudo() {
  const params = useSearchParams();
  // O formulário guarda a loja pelo NOME; a URL e o contexto trazem o ID.
  // `?loja=` vence; sem ele, vale a loja do contexto global.
  const { lojas, loja } = useLojaAtual();
  const idDaUrl = params.get("loja");
  // O formulário fixa o valor inicial no primeiro render: espera a lista chegar.
  if (lojas === null) return null;
  const padrao = (idDaUrl ? lojas.find((l) => l.id === idDaUrl) : loja)?.empresa;
  return <PendenciaForm clientePadrao={padrao} />;
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
