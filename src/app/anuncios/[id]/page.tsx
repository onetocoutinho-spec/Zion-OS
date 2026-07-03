"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ExternalLink, Lightbulb, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveQuery } from "@/lib/hooks";
import { buscarAnuncio, excluirAnuncio } from "@/lib/services/anuncios";
import { listarTarefasDoAnuncio } from "@/lib/services/tarefas";
import { formatDate } from "@/lib/format";
import type { Anuncio } from "@/lib/types";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-200">{children}</dd>
    </div>
  );
}

/** Gera sugestões de melhoria a partir das etapas ainda não concluídas. */
function melhoriasSugeridas(a: Anuncio): string[] {
  const sugestoes: string[] = [];
  if (a.statusSeo !== "Concluído") sugestoes.push("Otimizar SEO: título e palavras-chave da categoria.");
  if (a.statusDescricao !== "Concluído") sugestoes.push("Completar a descrição com benefícios e ficha técnica.");
  if (a.statusImagens !== "Concluído") sugestoes.push("Melhorar imagens: foto principal limpa + lifestyle + infográficos.");
  if (a.statusPrecificacao !== "Concluído") sugestoes.push("Revisar precificação considerando taxas e frete do marketplace.");
  if (a.statusConcorrencia !== "Concluído") sugestoes.push("Analisar os 5 principais concorrentes da categoria.");
  if (a.statusRevisao !== "Concluído") sugestoes.push("Passar pela revisão final de qualidade Zion.");
  if (a.statusPublicacao !== "Publicado") sugestoes.push("Publicar o anúncio após concluir as etapas anteriores.");
  if (a.tituloAtual !== a.tituloOtimizado && a.tituloOtimizado !== "—")
    sugestoes.push("Aplicar o título otimizado no marketplace.");
  return sugestoes;
}

export default function AnuncioDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: anuncio, carregando } = useLiveQuery(() => buscarAnuncio(id), [id]);
  const produto = anuncio?.produto ?? "";
  const { data: tarefas } = useLiveQuery(() => listarTarefasDoAnuncio(produto), [produto]);

  if (carregando) return null;
  if (!anuncio)
    return <EmptyState mensagem="Anúncio não encontrado." acaoLabel="Voltar para anúncios" acaoHref="/anuncios" />;

  const qs = `?cliente=${encodeURIComponent(anuncio.cliente)}&anuncio=${encodeURIComponent(anuncio.produto)}`;
  const sugestoes = melhoriasSugeridas(anuncio);

  async function excluir() {
    if (!window.confirm(`Excluir o anúncio de "${anuncio!.produto}"?`)) return;
    await excluirAnuncio(id);
    router.push("/anuncios");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-white">{anuncio.produto}</h1>
            <Badge tone="gray">{anuncio.marketplace}</Badge>
            <Badge>{anuncio.statusPublicacao}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {anuncio.cliente} · responsável: {anuncio.responsavel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/anuncios/${id}/editar`} variant="ghost">
            <Pencil size={14} /> Editar
          </LinkButton>
          <LinkButton href={`/tarefas/nova${qs}`} variant="ghost">
            <Plus size={14} /> Criar tarefa relacionada
          </LinkButton>
          {anuncio.link !== "—" && (
            <a
              href={anuncio.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
            >
              <ExternalLink size={14} /> Abrir anúncio
            </a>
          )}
          <Button variant="danger" onClick={excluir} title="Excluir anúncio">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Títulos">
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Título atual</p>
              <p className="mt-1 rounded-lg bg-white/[0.03] p-3 text-sm text-zinc-300">{anuncio.tituloAtual}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Título otimizado</p>
              <p className="mt-1 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-sm text-zinc-200">
                {anuncio.tituloOtimizado}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Próxima ação</p>
              <p className="mt-1 text-sm text-zinc-300">{anuncio.proximaAcao}</p>
            </div>
          </div>
        </Card>

        <Card title="Esteira de otimização">
          <dl className="space-y-3">
            <Info label="SEO"><Badge>{anuncio.statusSeo}</Badge></Info>
            <Info label="Descrição"><Badge>{anuncio.statusDescricao}</Badge></Info>
            <Info label="Imagens"><Badge>{anuncio.statusImagens}</Badge></Info>
            <Info label="Precificação"><Badge>{anuncio.statusPrecificacao}</Badge></Info>
            <Info label="Concorrência"><Badge>{anuncio.statusConcorrencia}</Badge></Info>
            <Info label="Revisão"><Badge>{anuncio.statusRevisao}</Badge></Info>
            <Info label="Publicação"><Badge>{anuncio.statusPublicacao}</Badge></Info>
          </dl>
        </Card>

        <Card title="Melhorias sugeridas">
          {sugestoes.length > 0 ? (
            <ul className="space-y-2.5">
              {sugestoes.map((s) => (
                <li key={s} className="flex items-start gap-2.5 text-sm text-zinc-300">
                  <Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-400" />
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-emerald-400">Anúncio 100% otimizado. Nenhuma melhoria pendente. ✓</p>
          )}
        </Card>

        <Card
          title={`Tarefas deste anúncio (${tarefas?.length ?? 0})`}
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
            <EmptyState compacto mensagem="Nenhuma tarefa vinculada a este anúncio." acaoLabel="Criar tarefa" acaoHref={`/tarefas/nova${qs}`} />
          )}
        </Card>
      </div>
    </div>
  );
}
