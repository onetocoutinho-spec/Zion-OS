"use client";

import Link from "next/link";
import {
  Users,
  Rocket,
  Package,
  Megaphone,
  AlarmClock,
  FileWarning,
  Wallet,
  ShieldAlert,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { listarOnboardings } from "@/lib/services/onboardings";
import { listarProdutos } from "@/lib/services/produtos";
import { listarAnuncios } from "@/lib/services/anuncios";
import { listarTarefas } from "@/lib/services/tarefas";
import { listarRelatorios } from "@/lib/services/relatorios";
import { listarFinanceiro } from "@/lib/services/financeiro";
import { formatBRL, formatDate, isOverdue } from "@/lib/format";

export default function DashboardPage() {
  const { data: clientesData } = useLiveQuery(listarClientes);
  const { data: onboardingsData } = useLiveQuery(listarOnboardings);
  const { data: produtosData } = useLiveQuery(listarProdutos);
  const { data: anunciosData } = useLiveQuery(listarAnuncios);
  const { data: tarefasData } = useLiveQuery(listarTarefas);
  const { data: relatoriosData } = useLiveQuery(listarRelatorios);
  const { data: financeiroData } = useLiveQuery(listarFinanceiro);

  const clientes = clientesData ?? [];
  const onboardings = onboardingsData ?? [];
  const produtos = produtosData ?? [];
  const anuncios = anunciosData ?? [];
  const tarefas = tarefasData ?? [];
  const relatorios = relatoriosData ?? [];
  const financeiro = financeiroData ?? [];

  // Indicadores calculados em tempo real a partir do store
  const clientesAtivos = clientes.filter((c) => c.status === "Ativo").length;
  const emOnboarding = clientes.filter((c) => c.status === "Onboarding").length;
  const produtosEmCadastro = produtos.filter(
    (p) => p.statusCadastro === "Em cadastro" || p.statusCadastro === "Não iniciado"
  ).length;
  const anunciosEmOtimizacao = anuncios.filter(
    (a) => a.statusRevisao !== "Concluído" || a.statusPublicacao !== "Publicado"
  ).length;
  const tarefasAtrasadas = tarefas.filter(
    (t) => t.status !== "Concluído" && isOverdue(t.prazo)
  );
  const relatoriosPendentes = relatorios.filter(
    (r) => r.status === "Pendente" || r.status === "Em elaboração"
  ).length;
  const faturamentoPrevisto = financeiro.reduce((sum, f) => sum + f.valorMensal, 0);
  const clientesEmRisco = clientes.filter(
    (c) => c.status === "Em risco" || c.risco === "Alto"
  ).length;

  const proximasAcoes = tarefas
    .filter((t) => t.status !== "Concluído")
    .sort((a, b) => {
      const peso = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };
      return peso[a.prioridade] - peso[b.prioridade] || a.prazo.localeCompare(b.prazo);
    })
    .slice(0, 5);

  const tarefasRecentes = tarefas.slice(0, 5);

  const clientesAtencao = clientes.filter(
    (c) => c.risco !== "Baixo" || c.status === "Em risco"
  );

  const pendenciasOnboarding = onboardings.reduce(
    (sum, o) => sum + o.pendenciasCliente.length,
    0
  );
  const tarefasConcluidas = tarefas.filter((t) => t.status === "Concluído").length;
  const anunciosPublicados = anuncios.filter(
    (a) => a.statusPublicacao === "Publicado"
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Visão geral da operação
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Resumo em tempo real dos clientes, produtos e tarefas da Zion Company.
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Clientes ativos" value={clientesAtivos} icon={Users} tone="green" hint="Contratos em operação" />
        <StatCard label="Clientes em onboarding" value={emOnboarding} icon={Rocket} tone="violet" hint="Entrando na operação" />
        <StatCard label="Produtos em cadastro" value={produtosEmCadastro} icon={Package} tone="blue" hint="Aguardando publicação" />
        <StatCard label="Anúncios em otimização" value={anunciosEmOtimizacao} icon={Megaphone} tone="cyan" hint="Na esteira de otimização" />
        <StatCard label="Tarefas atrasadas" value={tarefasAtrasadas.length} icon={AlarmClock} tone="red" hint="Prazo estourado" />
        <StatCard label="Relatórios pendentes" value={relatoriosPendentes} icon={FileWarning} tone="yellow" hint="A elaborar ou enviar" />
        <StatCard label="Faturamento previsto" value={formatBRL(faturamentoPrevisto)} icon={Wallet} tone="green" hint="Mensalidades do mês" />
        <StatCard label="Clientes em risco" value={clientesEmRisco} icon={ShieldAlert} tone="orange" hint="Exigem atenção imediata" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {/* Próximas ações prioritárias */}
        <Card title="Próximas ações prioritárias">
          <ul className="space-y-3">
            {proximasAcoes.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3">
                {/* 38px medidos no navegador; em toque sobe para 44 sem
                    mexer no espaçamento com mouse. São DUAS listas com este
                    mesmo Link — consertar uma só deixaria metade das tarefas
                    difíceis de acertar, e a asserção do script pegou isso. */}
                <Link
                  href={`/tarefas/${t.id}/editar`}
                  className="min-w-0 [@media(pointer:coarse)]:flex [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:flex-col [@media(pointer:coarse)]:justify-center"
                >
                  <p className="text-sm text-zinc-200 hover:text-violet-300">{t.proximaAcao}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {t.cliente} · {t.responsavel} · prazo {formatDate(t.prazo)}
                  </p>
                </Link>
                <Badge>{t.prioridade}</Badge>
              </li>
            ))}
            {proximasAcoes.length === 0 && (
              <p className="text-sm text-zinc-500">Nenhuma ação pendente. 🎉</p>
            )}
          </ul>
        </Card>

        {/* Tarefas recentes */}
        <Card title="Tarefas recentes">
          <ul className="space-y-3">
            {tarefasRecentes.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3">
                {/* 38px medidos no navegador; em toque sobe para 44 sem
                    mexer no espaçamento com mouse. São DUAS listas com este
                    mesmo Link — consertar uma só deixaria metade das tarefas
                    difíceis de acertar, e a asserção do script pegou isso. */}
                <Link
                  href={`/tarefas/${t.id}/editar`}
                  className="min-w-0 [@media(pointer:coarse)]:flex [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:flex-col [@media(pointer:coarse)]:justify-center"
                >
                  <p className="line-clamp-2 text-sm text-zinc-200 hover:text-violet-300">{t.tarefa}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {t.cliente} · {t.area}
                  </p>
                </Link>
                <Badge>{t.status}</Badge>
              </li>
            ))}
            {tarefasRecentes.length === 0 && (
              <p className="text-sm text-zinc-500">Nenhuma tarefa criada ainda.</p>
            )}
          </ul>
        </Card>

        {/* Clientes que precisam de atenção */}
        <Card title="Clientes que precisam de atenção">
          <ul className="space-y-3">
            {clientesAtencao.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3">
                <Link href={`/clientes/${c.id}`} className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200 hover:text-violet-300">{c.empresa}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{c.proximaAcao}</p>
                </Link>
                <div className="flex shrink-0 gap-1.5">
                  <Badge>{c.status}</Badge>
                  <Badge>{c.risco}</Badge>
                </div>
              </li>
            ))}
            {clientesAtencao.length === 0 && (
              <p className="text-sm text-zinc-500">Nenhum cliente em risco. ✓</p>
            )}
          </ul>
        </Card>

        {/* Resumo da semana */}
        <Card title="Resumo da operação da semana">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-lg font-semibold text-white">{tarefasConcluidas}</p>
              <p className="text-xs text-zinc-500">Tarefas concluídas</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-lg font-semibold text-white">{anunciosPublicados}</p>
              <p className="text-xs text-zinc-500">Anúncios no ar</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-lg font-semibold text-white">{pendenciasOnboarding}</p>
              <p className="text-xs text-zinc-500">Pendências de clientes</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-lg font-semibold text-white">{tarefasAtrasadas.length}</p>
              <p className="text-xs text-zinc-500">Tarefas atrasadas</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Priorize as tarefas urgentes e atrasadas, destrave os onboardings com
            pendências de cliente e feche os relatórios do período.
          </p>
        </Card>
      </div>
    </div>
  );
}
