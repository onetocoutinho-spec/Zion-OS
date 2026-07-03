"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProdutoForm } from "@/components/forms/ProdutoForm";
import { useLiveQuery } from "@/lib/hooks";
import { buscarProduto } from "@/lib/services/produtos";

export default function EditarProdutoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: produto, carregando } = useLiveQuery(() => buscarProduto(id), [id]);

  if (carregando) return null;
  if (!produto)
    return <EmptyState mensagem="Produto não encontrado." acaoLabel="Voltar para produtos" acaoHref="/produtos" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Editar ${produto.nome}`} description="Atualize os dados do produto." />
      <ProdutoForm inicial={produto} />
    </div>
  );
}
