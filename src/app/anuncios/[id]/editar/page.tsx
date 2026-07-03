"use client";

import { useParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { AnuncioForm } from "@/components/forms/AnuncioForm";
import { useLiveQuery } from "@/lib/hooks";
import { buscarAnuncio } from "@/lib/services/anuncios";

export default function EditarAnuncioPage() {
  const { id } = useParams<{ id: string }>();
  const { data: anuncio, carregando } = useLiveQuery(() => buscarAnuncio(id), [id]);

  if (carregando) return null;
  if (!anuncio)
    return <EmptyState mensagem="Anúncio não encontrado." acaoLabel="Voltar para anúncios" acaoHref="/anuncios" />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={`Editar anúncio — ${anuncio.produto}`} description="Atualize a esteira deste anúncio." />
      <AnuncioForm inicial={anuncio} />
    </div>
  );
}
