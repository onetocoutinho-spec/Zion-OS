"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { MARKETPLACES, PUBLICACAO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarAnuncios } from "@/lib/services/anuncios";

const HEADERS = [
  "Produto / Cliente",
  "Marketplace",
  "Título otimizado",
  "SEO",
  "Descrição",
  "Imagens",
  "Preço",
  "Concorrência",
  "Revisão",
  "Publicação",
  "Próxima ação",
  "Responsável",
];

export default function AnunciosPage() {
  const [publicacao, setPublicacao] = useState("Todos");
  const [marketplace, setMarketplace] = useState("Todos");
  const [cliente, setCliente] = useState("Todos");
  const { data: anuncios } = useLiveQuery(listarAnuncios);

  const clientesComAnuncio = [...new Set((anuncios ?? []).map((a) => a.cliente))];

  const filtrados = (anuncios ?? []).filter(
    (a) =>
      (publicacao === "Todos" || a.statusPublicacao === publicacao) &&
      (marketplace === "Todos" || a.marketplace === marketplace) &&
      (cliente === "Todos" || a.cliente === cliente)
  );

  return (
    <div>
      <PageHeader
        title="Anúncios"
        description="Esteira de otimização dos anúncios em cada marketplace. Clique para ver detalhes e melhorias sugeridas."
        count={filtrados.length}
        countLabel="anúncios"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Cliente" value={cliente} options={clientesComAnuncio} onChange={setCliente} />
          <FilterSelect label="Marketplace" value={marketplace} options={MARKETPLACES} onChange={setMarketplace} />
          <FilterSelect label="Publicação" value={publicacao} options={PUBLICACAO_STATUS} onChange={setPublicacao} />
        </div>
        <LinkButton href="/anuncios/novo">
          <Plus size={14} /> Novo anúncio
        </LinkButton>
      </div>

      <Table headers={HEADERS}>
        {anuncios && filtrados.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Nenhum anúncio encontrado."
            acaoLabel="Criar anúncio"
            acaoHref="/anuncios/novo"
          />
        )}
        {filtrados.map((a) => (
          <tr key={a.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3 align-top">
              <Link href={`/anuncios/${a.id}`}>
                <p className="whitespace-nowrap font-medium text-zinc-200 hover:text-violet-300">{a.produto}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{a.cliente}</p>
              </Link>
            </td>
            <Td><Badge tone="gray">{a.marketplace}</Badge></Td>
            <Td className="min-w-48 max-w-60 text-xs text-zinc-300">{a.tituloOtimizado}</Td>
            <Td><Badge>{a.statusSeo}</Badge></Td>
            <Td><Badge>{a.statusDescricao}</Badge></Td>
            <Td><Badge>{a.statusImagens}</Badge></Td>
            <Td><Badge>{a.statusPrecificacao}</Badge></Td>
            <Td><Badge>{a.statusConcorrencia}</Badge></Td>
            <Td><Badge>{a.statusRevisao}</Badge></Td>
            <Td><Badge>{a.statusPublicacao}</Badge></Td>
            <Td className="min-w-56 text-xs text-zinc-300">{a.proximaAcao}</Td>
            <Td className="whitespace-nowrap">{a.responsavel}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
