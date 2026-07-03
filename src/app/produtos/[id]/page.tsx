"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExecutarComAgente } from "@/components/agentes/ExecutarComAgente";
import { useLiveQuery } from "@/lib/hooks";
import { buscarProduto, excluirProduto } from "@/lib/services/produtos";
import { listarAnunciosDoProduto } from "@/lib/services/anuncios";
import { listarTarefasDoProduto } from "@/lib/services/tarefas";
import { formatBRL, formatDate } from "@/lib/format";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-200">{children}</dd>
    </div>
  );
}

export default function ProdutoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: produto, carregando } = useLiveQuery(() => buscarProduto(id), [id]);
  const { data: anuncios } = useLiveQuery(() => listarAnunciosDoProduto(id), [id]);
  const { data: tarefas } = useLiveQuery(() => listarTarefasDoProduto(id), [id]);

  if (carregando) return null;
  if (!produto)
    return <EmptyState mensagem="Produto não encontrado." acaoLabel="Voltar para produtos" acaoHref="/produtos" />;

  const qs = `?cliente=${encodeURIComponent(produto.cliente)}&produto=${encodeURIComponent(produto.nome)}`;
  const margem =
    produto.precoVenda > 0
      ? Math.round(((produto.precoVenda - produto.custo) / produto.precoVenda) * 100)
      : 0;

  async function excluir() {
    if (!window.confirm(`Excluir o produto "${produto!.nome}"?`)) return;
    await excluirProduto(id);
    router.push("/produtos");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-white">{produto.nome}</h1>
            <Badge>{produto.statusCadastro}</Badge>
            <Badge>{produto.prioridade}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            <Link href="/clientes" className="hover:text-violet-300">{produto.cliente}</Link>
            {" · "}{produto.marca} · SKU {produto.sku}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/produtos/${id}/editar`} variant="ghost">
            <Pencil size={14} /> Editar
          </LinkButton>
          <LinkButton href={`/tarefas/nova${qs}`} variant="ghost">
            <Plus size={14} /> Criar tarefa relacionada
          </LinkButton>
          <LinkButton href={`/anuncios/novo${qs}`} variant="ghost">
            <Plus size={14} /> Criar anúncio
          </LinkButton>
          <ExecutarComAgente clienteId={produto.clienteId} produtoId={id} />
          <Button variant="danger" onClick={excluir} title="Excluir produto">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Dados gerais">
          <dl className="space-y-3">
            <Info label="Cliente">{produto.cliente}</Info>
            <Info label="Marca / Modelo">{produto.marca} / {produto.modelo}</Info>
            <Info label="Categoria">{produto.categoria}</Info>
            <Info label="SKU"><span className="font-mono text-xs">{produto.sku}</span></Info>
            <Info label="Variação">{produto.cor} / {produto.tamanho}</Info>
            <Info label="Marketplace"><Badge tone="gray">{produto.marketplace}</Badge></Info>
            <Info label="Custo">{formatBRL(produto.custo)}</Info>
            <Info label="Preço de venda">{formatBRL(produto.precoVenda)}</Info>
            <Info label="Margem bruta">{margem}%</Info>
            <Info label="Estoque">{produto.estoque} un.</Info>
          </dl>
          {produto.observacoes && (
            <p className="mt-4 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-zinc-400">
              {produto.observacoes}
            </p>
          )}
        </Card>

        <Card title="Esteira de cadastro">
          <dl className="space-y-3">
            <Info label="Cadastro"><Badge>{produto.statusCadastro}</Badge></Info>
            <Info label="SEO"><Badge>{produto.statusSeo}</Badge></Info>
            <Info label="Descrição"><Badge>{produto.statusDescricao}</Badge></Info>
            <Info label="Imagens"><Badge>{produto.statusImagens}</Badge></Info>
            <Info label="Precificação"><Badge>{produto.statusPrecificacao}</Badge></Info>
            <Info label="Prioridade"><Badge>{produto.prioridade}</Badge></Info>
          </dl>
        </Card>

        <Card title={`Anúncios deste produto (${anuncios?.length ?? 0})`}>
          {anuncios && anuncios.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {anuncios.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/anuncios/${a.id}`} className="min-w-0">
                    <p className="truncate text-sm text-zinc-200 hover:text-violet-300">{a.marketplace}</p>
                    <p className="truncate text-xs text-zinc-500">{a.proximaAcao}</p>
                  </Link>
                  <Badge>{a.statusPublicacao}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Nenhum anúncio criado para este produto." acaoLabel="Criar anúncio" acaoHref={`/anuncios/novo${qs}`} />
          )}
        </Card>

        <Card
          title={`Tarefas deste produto (${tarefas?.length ?? 0})`}
          action={
            <Link href={`/tarefas/nova${qs}`} className="text-xs text-violet-400 hover:text-violet-300">
              + Criar tarefa relacionada
            </Link>
          }
        >
          {tarefas && tarefas.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {tarefas.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/tarefas/${t.id}/editar`} className="min-w-0">
                    <p className="truncate text-sm text-zinc-200 hover:text-violet-300">{t.tarefa}</p>
                    <p className="text-xs text-zinc-500">{t.responsavel} · prazo {formatDate(t.prazo)}</p>
                  </Link>
                  <Badge>{t.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Nenhuma tarefa vinculada a este produto." acaoLabel="Criar tarefa" acaoHref={`/tarefas/nova${qs}`} />
          )}
        </Card>
      </div>
    </div>
  );
}
