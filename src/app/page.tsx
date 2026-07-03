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
import { clientes } from "@/lib/data/clientes";
import { onboardings } from "@/lib/data/onboardings";
import { produtos } from "@/lib/data/produtos";
import { anuncios } from "@/lib/data/anuncios";
import { tarefas } from "@/lib/data/tarefas";
import { relatorios } from "@/lib/data/relatorios";
import { financeiro } from "@/lib/data/financeiro";
import { formatBRL, formatDate, isOverdue } from "@/lib/format";

export default function DashboardPage() {
  // Indicadores calculados a partir dos dados mockados
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
                <div className="min-w-0">
                  <p className="text-sm text-zinc-200">{t.proximaAcao}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {t.cliente} · {t.responsavel} · prazo {formatDate(t.prazo)}
                  </p>
                </div>
                <Badge>{t.prioridade}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* Tarefas recentes */}
        <Card title="Tarefas recentes">
          <ul className="space-y-3">
            {tarefasRecentes.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-200">{t.tarefa}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {t.cliente} · {t.area}
                  </p>
                </div>
                <Badge>{t.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>

        {/* Clientes que precisam de atenção */}
        <Card title="Clientes que precisam de atenção">
          <ul className="space-y-3">
            {clientesAtencao.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{c.empresa}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{c.proximaAcao}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Badge>{c.status}</Badge>
                  <Badge>{c.risco}</Badge>
                </div>
              </li>
            ))}
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
            Foco da semana: destravar o anúncio da AutoPeças Silva, concluir os
            onboardings da FitPro e Kids Mundo e fechar os relatórios de junho.
          </p>
        </Card>
      </div>
    </div>
  );
}
