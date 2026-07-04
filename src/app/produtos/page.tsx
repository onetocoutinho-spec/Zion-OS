"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Upload, ChevronDown, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Table, Td } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { CADASTRO_STATUS, PRIORIDADES } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutos } from "@/lib/services/produtos";
import { formatBRL } from "@/lib/format";
import type { Produto } from "@/lib/types";

const HEADERS = [
  "Produto",
  "SKU",
  "Custo",
  "Preço",
  "Estoque",
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
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const { data: produtos } = useLiveQuery(listarProdutos);

  const clientesComProduto = [...new Set((produtos ?? []).map((p) => p.cliente))];

  const filtrados = (produtos ?? []).filter(
    (p) =>
      (status === "Todos" || p.statusCadastro === status) &&
      (prioridade === "Todos" || p.prioridade === prioridade) &&
      (cliente === "Todos" || p.cliente === cliente)
  );

  // Agrupa por cliente (ordem alfabética)
  const grupos = useMemo(() => {
    const map = new Map<string, Produto[]>();
    filtrados.forEach((p) => {
      const arr = map.get(p.cliente) ?? [];
      arr.push(p);
      map.set(p.cliente, arr);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtrados]);

  function toggle(nome: string) {
    setColapsados((prev) => {
      const n = new Set(prev);
      if (n.has(nome)) n.delete(nome);
      else n.add(nome);
      return n;
    });
  }

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Base de produtos por cliente. Cada cliente tem sua própria base para iniciar o cadastramento nos marketplaces."
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

      {produtos && grupos.length === 0 && (
        <EmptyState
          mensagem="Nenhum produto encontrado com os filtros atuais."
          acaoLabel="Importar base de um cliente"
          acaoHref="/produtos/importar"
        />
      )}

      <div className="space-y-5">
        {grupos.map(([nome, itens]) => {
          const aberto = !colapsados.has(nome);
          const estoqueTotal = itens.reduce((s, p) => s + p.estoque, 0);
          return (
            <section key={nome}>
              <button
                onClick={() => toggle(nome)}
                className="mb-2 flex w-full items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]"
              >
                <div className="flex items-center gap-2.5">
                  <ChevronDown
                    size={16}
                    className={`shrink-0 text-zinc-500 transition-transform ${aberto ? "" : "-rotate-90"}`}
                  />
                  <Users size={15} className="shrink-0 text-violet-400" />
                  <span className="text-sm font-semibold text-zinc-100">{nome}</span>
                  <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-xs text-zinc-400">
                    {itens.length} {itens.length === 1 ? "produto" : "produtos"}
                  </span>
                </div>
                <span className="text-xs text-zinc-500">{estoqueTotal} em estoque</span>
              </button>

              {aberto && (
                <Table headers={HEADERS}>
                  {itens.map((p) => (
                    <tr key={p.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 align-top">
                        <Link href={`/produtos/${p.id}`}>
                          <p className="whitespace-nowrap font-medium text-zinc-200 hover:text-violet-300">{p.nome}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">{p.marca} · {p.modelo}</p>
                        </Link>
                      </td>
                      <Td className="whitespace-nowrap font-mono text-xs">{p.sku}</Td>
                      <Td className="whitespace-nowrap">{formatBRL(p.custo)}</Td>
                      <Td className="whitespace-nowrap text-zinc-200">{formatBRL(p.precoVenda)}</Td>
                      <Td>{p.estoque}</Td>
                      <Td><Badge>{p.statusCadastro}</Badge></Td>
                      <Td><Badge>{p.statusSeo}</Badge></Td>
                      <Td><Badge>{p.statusDescricao}</Badge></Td>
                      <Td><Badge>{p.statusImagens}</Badge></Td>
                      <Td><Badge>{p.statusPrecificacao}</Badge></Td>
                      <Td><Badge>{p.prioridade}</Badge></Td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
