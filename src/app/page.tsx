"use client";

import Link from "next/link";
import {
  Users,
  Rocket,
  Package,
  Megaphone,
  FileWarning,
  ShieldAlert,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useLiveQuery } from "@/lib/hooks";
import { listarClientes } from "@/lib/services/clientes";
import { listarProdutos } from "@/lib/services/produtos";
import { listarResumoDeAnuncios } from "@/lib/services/anunciosGerados";
import { listarRelatorios } from "@/lib/services/relatorios";

export default function DashboardPage() {
  const { data: clientesData } = useLiveQuery(listarClientes);
  const { data: produtosData } = useLiveQuery(listarProdutos);
  const { data: anunciosData } = useLiveQuery(listarResumoDeAnuncios);
  const { data: relatoriosData } = useLiveQuery(listarRelatorios);

  const clientes = clientesData ?? [];
  const produtos = produtosData ?? [];
  const anuncios = anunciosData ?? [];
  const relatorios = relatoriosData ?? [];

  // Indicadores calculados em tempo real a partir do store.
  //
  // Tudo aqui se DERIVA do catálogo e dos anúncios. Nada depende de alguém da
  // Zion ter lembrado de registrar uma tarefa, uma reunião ou uma mensalidade —
  // as três telas que sustentavam esses números saíram em 07/08, com zero linhas
  // no banco depois de meses. Número que só existe se um humano digitar é
  // número que fica desatualizado em silêncio.
  //
  // OS ANÚNCIOS VÊM DE `anuncios_gerados`, e essa troca é o conserto de um
  // defeito meu: quando reescrevi este painel algumas horas antes, apontei os
  // cartões para `anuncios` — a tabela da era agência, com ZERO linhas. Dois
  // cartões mostravam zero numa loja com 790 anúncios publicados. A tabela viva
  // é a da esteira, e é ela que o resto do produto usa (18 arquivos contra um).
  //
  // `listarResumoDeAnuncios` não traz o JSONB do conteúdo: contar não pode
  // custar 1 MB de anúncio que ninguém vai abrir nesta tela.
  //
  // O CUSTO QUE SOBRA, medido e aceito: mesmo sem o JSONB, são ~322 kB por
  // carga (1.377 kB menos os 1.055 do JSONB, em 880 anúncios) para produzir
  // DOIS inteiros. Aceito porque esta tela é só da equipe — a agência não tem
  // "/" no menu (`navDoPapel`) e a lojista vive em /cliente. São dois usuários.
  //
  // O gatilho para trocar por um `count: "exact", head: true` é claro: no dia
  // em que o painel abrir para a agência, ou em que os anúncios passarem de
  // alguns milhares. Egress é a parede mais próxima do plano Free.
  const clientesAtivos = clientes.filter((c) => c.status === "Ativo").length;
  const emOnboarding = clientes.filter((c) => c.status === "Onboarding").length;
  const produtosEmCadastro = produtos.filter(
    (p) => p.statusCadastro === "Em cadastro" || p.statusCadastro === "Não iniciado"
  ).length;
  const anunciosEmOtimizacao = anuncios.filter((a) => a.status !== "publicado").length;
  const relatoriosPendentes = relatorios.filter(
    (r) => r.status === "Pendente" || r.status === "Em elaboração"
  ).length;
  const clientesEmRisco = clientes.filter(
    (c) => c.status === "Em risco" || c.risco === "Alto"
  ).length;

  const clientesAtencao = clientes.filter(
    (c) => c.risco !== "Baixo" || c.status === "Em risco"
  );

  const anunciosPublicados = anuncios.filter((a) => a.status === "publicado").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">
          Visão geral da operação
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Resumo em tempo real dos clientes, produtos e anúncios da Zion Company.
        </p>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3">
        <StatCard label="Clientes ativos" value={clientesAtivos} icon={Users} tone="green" hint="Contratos em operação" />
        <StatCard label="Clientes em onboarding" value={emOnboarding} icon={Rocket} tone="violet" hint="Entrando na operação" />
        <StatCard label="Produtos em cadastro" value={produtosEmCadastro} icon={Package} tone="blue" hint="Aguardando publicação" />
        <StatCard label="Anúncios em produção" value={anunciosEmOtimizacao} icon={Megaphone} tone="cyan" hint="Na esteira, ainda não publicados" />
        <StatCard label="Relatórios pendentes" value={relatoriosPendentes} icon={FileWarning} tone="yellow" hint="A elaborar ou enviar" />
        <StatCard label="Clientes em risco" value={clientesEmRisco} icon={ShieldAlert} tone="orange" hint="Exigem atenção imediata" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
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
              <p className="text-lg font-semibold text-white">{anunciosPublicados}</p>
              <p className="text-xs text-zinc-500">Anúncios no ar</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-lg font-semibold text-white">{anunciosEmOtimizacao}</p>
              <p className="text-xs text-zinc-500">Na esteira</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-lg font-semibold text-white">{produtos.length}</p>
              <p className="text-xs text-zinc-500">Produtos no catálogo</p>
            </div>
            <div className="rounded-lg bg-white/[0.03] p-3">
              <p className="text-lg font-semibold text-white">{produtosEmCadastro}</p>
              <p className="text-xs text-zinc-500">Produtos em cadastro</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-zinc-500">
            Destrave os produtos parados no cadastro, feche os anúncios que ainda
            estão na esteira e envie os relatórios do período.
          </p>
        </Card>
      </div>
    </div>
  );
}
