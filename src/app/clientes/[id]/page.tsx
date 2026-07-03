"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil, Plus, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveQuery } from "@/lib/hooks";
import { alterarStatusCliente, buscarCliente, excluirCliente } from "@/lib/services/clientes";
import { listarProdutosDoCliente } from "@/lib/services/produtos";
import { listarAnunciosDoCliente } from "@/lib/services/anuncios";
import { listarTarefasDoCliente } from "@/lib/services/tarefas";
import { listarRelatoriosDoCliente } from "@/lib/services/relatorios";
import { listarFinanceiroDoCliente } from "@/lib/services/financeiro";
import { buscarOnboardingDoCliente } from "@/lib/services/onboardings";
import { listarReunioesDoCliente } from "@/lib/services/reunioes";
import { formatBRL, formatDate, formatDateTime } from "@/lib/format";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-200">{children}</dd>
    </div>
  );
}

export default function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const { data: cliente, carregando } = useLiveQuery(() => buscarCliente(id), [id]);
  const { data: produtos } = useLiveQuery(() => listarProdutosDoCliente(id), [id]);
  const { data: anuncios } = useLiveQuery(() => listarAnunciosDoCliente(id), [id]);
  const { data: tarefas } = useLiveQuery(() => listarTarefasDoCliente(id), [id]);
  const { data: relatorios } = useLiveQuery(() => listarRelatoriosDoCliente(id), [id]);
  const { data: financeiro } = useLiveQuery(() => listarFinanceiroDoCliente(id), [id]);
  const { data: onboarding } = useLiveQuery(() => buscarOnboardingDoCliente(id), [id]);
  const { data: reunioes } = useLiveQuery(() => listarReunioesDoCliente(id), [id]);

  if (carregando) return null;
  if (!cliente)
    return <EmptyState mensagem="Cliente não encontrado." acaoLabel="Voltar para clientes" acaoHref="/clientes" />;

  const emRisco = cliente.status === "Em risco";
  const qs = `?cliente=${encodeURIComponent(cliente.empresa)}`;

  async function excluir() {
    if (!window.confirm(`Excluir o cliente "${cliente!.empresa}"? Esta ação não pode ser desfeita.`)) return;
    await excluirCliente(id);
    router.push("/clientes");
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho e ações */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-white">{cliente.empresa}</h1>
            <Badge>{cliente.status}</Badge>
            <Badge>{cliente.risco}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            {cliente.segmento} · {cliente.responsavel} · plano {cliente.plano}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <LinkButton href={`/clientes/${id}/editar`} variant="ghost">
            <Pencil size={14} /> Editar
          </LinkButton>
          <LinkButton href={`/tarefas/nova${qs}`} variant="ghost">
            <Plus size={14} /> Tarefa
          </LinkButton>
          <LinkButton href={`/produtos/novo${qs}`} variant="ghost">
            <Plus size={14} /> Produto
          </LinkButton>
          <LinkButton href={`/relatorios/novo${qs}`} variant="ghost">
            <Plus size={14} /> Relatório
          </LinkButton>
          {emRisco ? (
            <Button variant="success" onClick={() => alterarStatusCliente(id, "Ativo")}>
              <ShieldCheck size={14} /> Marcar como ativo
            </Button>
          ) : (
            <Button variant="danger" onClick={() => alterarStatusCliente(id, "Em risco")}>
              <ShieldAlert size={14} /> Marcar em risco
            </Button>
          )}
          <Button variant="danger" onClick={excluir} title="Excluir cliente">
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Dados gerais */}
        <Card title="Dados gerais">
          <dl className="space-y-3">
            <Info label="Responsável">{cliente.responsavel}</Info>
            <Info label="Segmento">{cliente.segmento}</Info>
            <Info label="Plano contratado">{cliente.plano}</Info>
            <Info label="Data de entrada">{formatDate(cliente.dataEntrada)}</Info>
            <Info label="Próxima reunião">{formatDate(cliente.proximaReuniao)}</Info>
            <Info label="Marketplaces">
              <span className="flex flex-wrap justify-end gap-1">
                {cliente.marketplaces.length === 0 && "—"}
                {cliente.marketplaces.map((m) => (
                  <Badge key={m} tone="gray">{m}</Badge>
                ))}
              </span>
            </Info>
            <Info label="Próxima ação">{cliente.proximaAcao}</Info>
          </dl>
          {cliente.observacoes && (
            <p className="mt-4 rounded-lg bg-white/[0.03] p-3 text-xs leading-relaxed text-zinc-400">
              {cliente.observacoes}
            </p>
          )}
        </Card>

        {/* Pendências (do onboarding) */}
        <Card title="Pendências e onboarding">
          {onboarding ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Checklist de onboarding</span>
                <Link href="/onboarding" className="text-xs text-violet-400 hover:text-violet-300">
                  Abrir onboarding →
                </Link>
              </div>
              {onboarding.pendenciasCliente.length > 0 ? (
                <ul className="list-inside list-disc space-y-1.5 text-sm text-zinc-400">
                  {onboarding.pendenciasCliente.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">Nenhuma pendência do cliente. ✓</p>
              )}
            </>
          ) : (
            <EmptyState compacto mensagem="Este cliente não tem onboarding registrado." />
          )}
        </Card>

        {/* Produtos vinculados */}
        <Card title={`Produtos (${produtos?.length ?? 0})`}>
          {produtos && produtos.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {produtos.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/produtos/${p.id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200 hover:text-violet-300">{p.nome}</p>
                    <p className="text-xs text-zinc-500">{p.sku} · {p.marketplace} · {formatBRL(p.precoVenda)}</p>
                  </Link>
                  <Badge>{p.statusCadastro}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Nenhum produto vinculado a este cliente." acaoLabel="Criar produto" acaoHref={`/produtos/novo${qs}`} />
          )}
        </Card>

        {/* Anúncios vinculados */}
        <Card title={`Anúncios (${anuncios?.length ?? 0})`}>
          {anuncios && anuncios.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {anuncios.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/anuncios/${a.id}`} className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-200 hover:text-violet-300">{a.produto}</p>
                    <p className="text-xs text-zinc-500">{a.marketplace} · {a.proximaAcao}</p>
                  </Link>
                  <Badge>{a.statusPublicacao}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Nenhum anúncio vinculado a este cliente." acaoLabel="Criar anúncio" acaoHref={`/anuncios/novo${qs}`} />
          )}
        </Card>

        {/* Tarefas vinculadas */}
        <Card
          title={`Tarefas (${tarefas?.length ?? 0})`}
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
            <EmptyState compacto mensagem="Nenhuma tarefa pendente para este cliente." acaoLabel="Criar tarefa" acaoHref={`/tarefas/nova${qs}`} />
          )}
        </Card>

        {/* Relatórios vinculados */}
        <Card title={`Relatórios (${relatorios?.length ?? 0})`}>
          {relatorios && relatorios.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {relatorios.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/relatorios/${r.id}/editar`} className="min-w-0">
                    <p className="text-sm text-zinc-200 hover:text-violet-300">{r.periodo}</p>
                    <p className="truncate text-xs text-zinc-500">{r.proximasAcoes}</p>
                  </Link>
                  <Badge>{r.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Nenhum relatório criado ainda." acaoLabel="Criar relatório" acaoHref={`/relatorios/novo${qs}`} />
          )}
        </Card>

        {/* Reuniões */}
        <Card
          title={`Reuniões (${reunioes?.length ?? 0})`}
          action={
            <Link
              href={`/reunioes/nova${qs}`}
              className="text-xs text-violet-400 hover:text-violet-300"
            >
              + Agendar reunião
            </Link>
          }
        >
          {reunioes && reunioes.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {reunioes.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/reunioes/${r.id}/editar`} className="min-w-0">
                    <p className="truncate text-sm text-zinc-200 hover:text-violet-300">{r.titulo}</p>
                    <p className="text-xs text-zinc-500">{formatDateTime(r.dataHora)}</p>
                  </Link>
                  <Badge>{r.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Nenhuma reunião com este cliente." acaoLabel="Agendar reunião" acaoHref={`/reunioes/nova${qs}`} />
          )}
        </Card>

        {/* Financeiro vinculado */}
        <Card title="Financeiro">
          {financeiro && financeiro.length > 0 ? (
            <ul className="divide-y divide-white/[0.04]">
              {financeiro.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm text-zinc-200">
                      {formatBRL(f.valorMensal)} <span className="text-zinc-500">/ mês · vence {formatDate(f.dataVencimento)}</span>
                    </p>
                    <p className="text-xs text-zinc-500">Lucro estimado: {formatBRL(f.lucroEstimado)}</p>
                  </div>
                  <Badge>{f.statusPagamento}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Nenhum registro financeiro para este cliente." acaoLabel="Criar registro" acaoHref={`/financeiro/novo${qs}`} />
          )}
        </Card>
      </div>
    </div>
  );
}
