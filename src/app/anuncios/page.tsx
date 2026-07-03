"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { anuncios } from "@/lib/data/anuncios";

const STATUS_PUBLICACAO = ["Pendente", "Agendado", "Publicado"];
const MARKETPLACES = ["Mercado Livre", "TikTok Shop", "Shopee", "Amazon"];
const CLIENTES = [...new Set(anuncios.map((a) => a.cliente))];

const HEADERS = [
  "Produto / Cliente",
  "Marketplace",
  "Título atual",
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
  "Link",
];

export default function AnunciosPage() {
  const [publicacao, setPublicacao] = useState("Todos");
  const [marketplace, setMarketplace] = useState("Todos");
  const [cliente, setCliente] = useState("Todos");

  const filtrados = anuncios.filter(
    (a) =>
      (publicacao === "Todos" || a.statusPublicacao === publicacao) &&
      (marketplace === "Todos" || a.marketplace === marketplace) &&
      (cliente === "Todos" || a.cliente === cliente)
  );

  return (
    <div>
      <PageHeader
        title="Anúncios"
        description="Esteira de otimização dos anúncios em cada marketplace."
        count={filtrados.length}
        countLabel="anúncios"
      />

      <div className="mb-4 flex flex-wrap gap-4">
        <FilterSelect label="Cliente" value={cliente} options={CLIENTES} onChange={setCliente} />
        <FilterSelect label="Marketplace" value={marketplace} options={MARKETPLACES} onChange={setMarketplace} />
        <FilterSelect label="Publicação" value={publicacao} options={STATUS_PUBLICACAO} onChange={setPublicacao} />
      </div>

      <Table headers={HEADERS}>
        {filtrados.length === 0 && <EmptyRow colSpan={HEADERS.length} />}
        {filtrados.map((a) => (
          <tr key={a.id} className="hover:bg-white/[0.02]">
            <TdMain sub={a.cliente}>{a.produto}</TdMain>
            <Td><Badge tone="gray">{a.marketplace}</Badge></Td>
            <Td className="min-w-48 max-w-60 text-xs">{a.tituloAtual}</Td>
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
            <Td>
              {a.link !== "—" ? (
                <a
                  href={a.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300"
                >
                  Abrir <ExternalLink size={12} />
                </a>
              ) : (
                <span className="text-zinc-600">—</span>
              )}
            </Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
