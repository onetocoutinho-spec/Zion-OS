"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProdutoForm } from "@/components/forms/ProdutoForm";

function Conteudo() {
  const params = useSearchParams();
  // O formulário guarda a loja pelo NOME; a URL e o contexto trazem o ID.
  // `?loja=` vence; sem ele, vale a loja do contexto global.
  const { lojas, loja } = useLojaAtual();
  const idDaUrl = params.get("loja");
  // O formulário fixa o valor inicial no primeiro render: espera a lista chegar.
  if (lojas === null) return null;
  const padrao = (idDaUrl ? lojas.find((l) => l.id === idDaUrl) : loja)?.empresa;
  return <ProdutoForm clientePadrao={padrao} />;
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
