"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { CADASTRO_STATUS, PRIORIDADES } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { formatBRL } from "@/lib/format";

const HEADERS = [
  "Produto",
  "Cliente",
  "SKU",
  "Custo",
  "Preço",
  "Estoque",
  "Marketplace",
  "Cadastro",
  "SEO",
  "Descrição",
  "Imagens",
  "Preço OK",
  "Prioridade",
];

export default function ProdutosPage() {
  const [status, setStatus] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todos");
  const [cliente, setCliente] = useState("Todos");
  const { data: produtos } = useLiveQuery(listarProdutos);

  const clientesComProduto = [...new Set((produtos ?? []).map((p) => p.cliente))];

  const filtrados = (produtos ?? []).filter(
    (p) =>
      (status === "Todos" || p.statusCadastro === status) &&
      (prioridade === "Todos" || p.prioridade === prioridade) &&
      (cliente === "Todos" || p.cliente === cliente)
  );

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Base de produtos dos clientes e status da esteira de cadastro."
        count={filtrados.length}
        countLabel="produtos"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Cliente" value={cliente} options={clientesComProduto} onChange={setCliente} />
          <FilterSelect label="Cadastro" value={status} options={CADASTRO_STATUS} onChange={setStatus} />
          <FilterSelect label="Prioridade" value={prioridade} options={PRIORIDADES} onChange={setPrioridade} />
        </div>
        <div className="flex gap-2">
          <LinkButton href="/produtos/importar" variant="ghost">
            <Upload size={14} /> Importar base
          </LinkButton>
          <LinkButton href="/produtos/novo">
            <Plus size={14} /> Novo produto
          </LinkButton>
        </div>
      </div>

      <Table headers={HEADERS}>
        {produtos && filtrados.length === 0 && (
          <EmptyRow
            colSpan={HEADERS.length}
            mensagem="Nenhum produto encontrado."
            acaoLabel="Criar produto"
            acaoHref="/produtos/novo"
          />
        )}
        {filtrados.map((p) => (
          <tr key={p.id} className="hover:bg-white/[0.02]">
            <td className="px-4 py-3 align-top">
              <Link href={`/produtos/${p.id}`}>
                <p className="whitespace-nowrap font-medium text-zinc-200 hover:text-violet-300">{p.nome}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{p.marca} · {p.modelo}</p>
              </Link>
            </td>
            <Td className="whitespace-nowrap">{p.cliente}</Td>
            <Td className="whitespace-nowrap font-mono text-xs">{p.sku}</Td>
            <Td className="whitespace-nowrap">{formatBRL(p.custo)}</Td>
            <Td className="whitespace-nowrap text-zinc-200">{formatBRL(p.precoVenda)}</Td>
            <Td>{p.estoque}</Td>
            <Td><Badge tone="gray">{p.marketplace}</Badge></Td>
            <Td><Badge>{p.statusCadastro}</Badge></Td>
            <Td><Badge>{p.statusSeo}</Badge></Td>
            <Td><Badge>{p.statusDescricao}</Badge></Td>
            <Td><Badge>{p.statusImagens}</Badge></Td>
            <Td><Badge>{p.statusPrecificacao}</Badge></Td>
            <Td><Badge>{p.prioridade}</Badge></Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
