"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { produtos } from "@/lib/data/produtos";
import { formatBRL } from "@/lib/format";

const STATUS_CADASTRO = ["Não iniciado", "Em cadastro", "Publicado", "Com erro"];
const PRIORIDADES = ["Baixa", "Média", "Alta", "Urgente"];
const CLIENTES = [...new Set(produtos.map((p) => p.cliente))];

const HEADERS = [
  "Produto",
  "Cliente",
  "SKU",
  "Categoria",
  "Variação",
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
  "Observações",
];

export default function ProdutosPage() {
  const [status, setStatus] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todos");
  const [cliente, setCliente] = useState("Todos");

  const filtrados = produtos.filter(
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

      <div className="mb-4 flex flex-wrap gap-4">
        <FilterSelect label="Cliente" value={cliente} options={CLIENTES} onChange={setCliente} />
        <FilterSelect label="Cadastro" value={status} options={STATUS_CADASTRO} onChange={setStatus} />
        <FilterSelect label="Prioridade" value={prioridade} options={PRIORIDADES} onChange={setPrioridade} />
      </div>

      <Table headers={HEADERS}>
        {filtrados.length === 0 && <EmptyRow colSpan={HEADERS.length} />}
        {filtrados.map((p) => (
          <tr key={p.id} className="hover:bg-white/[0.02]">
            <TdMain sub={`${p.marca} · ${p.modelo}`}>{p.nome}</TdMain>
            <Td className="whitespace-nowrap">{p.cliente}</Td>
            <Td className="whitespace-nowrap font-mono text-xs">{p.sku}</Td>
            <Td className="whitespace-nowrap text-xs">{p.categoria}</Td>
            <Td className="whitespace-nowrap text-xs">{p.cor} / {p.tamanho}</Td>
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
            <Td className="min-w-56 text-xs">{p.observacoes || "—"}</Td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
