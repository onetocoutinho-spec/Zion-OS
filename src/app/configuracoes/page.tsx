"use client";

import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { resetStore } from "@/lib/store";
import { supabaseConfigurado } from "@/lib/supabase/client";

const INTEGRACOES = [
  { nome: "Mercado Livre", descricao: "Sincronizar anúncios, perguntas e métricas" },
  { nome: "TikTok Shop", descricao: "Sincronizar catálogo e pedidos" },
  { nome: "Shopee", descricao: "Sincronizar anúncios e campanhas" },
  { nome: "Amazon", descricao: "Sincronizar listings e buy box" },
  { nome: "Autenticação (Supabase Auth)", descricao: "Login da equipe — v1.3" },
  { nome: "API Claude", descricao: "Execução real dos agentes de IA" },
];

const EQUIPE = [
  { nome: "Camila", papel: "Gestão de contas e comercial" },
  { nome: "Lucas", papel: "Marketplace — Mercado Livre e Shopee" },
  { nome: "Amanda", papel: "Criativos e TikTok Shop" },
  { nome: "Rafael", papel: "Precificação e Amazon" },
];

export default function ConfiguracoesPage() {
  return (
    <div>
      <PageHeader
        title="Configurações"
        description="Dados da agência, equipe e integrações planejadas."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Agência">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Nome</dt>
              <dd className="text-zinc-200">Zion Company</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Especialidade</dt>
              <dd className="text-right text-zinc-200">
                Gestão de vendas em marketplaces
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Marketplaces atendidos</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                <Badge tone="gray">Mercado Livre</Badge>
                <Badge tone="gray">TikTok Shop</Badge>
                <Badge tone="gray">Shopee</Badge>
                <Badge tone="gray">Amazon</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Planos</dt>
              <dd className="flex flex-wrap justify-end gap-1">
                <Badge tone="cyan">Início</Badge>
                <Badge tone="blue">Organiza</Badge>
                <Badge tone="violet">Escala</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Versão do sistema</dt>
              <dd className="text-zinc-200">Zion OS v1.2 (Supabase)</dd>
            </div>
          </dl>
        </Card>

        <Card title="Equipe">
          <ul className="space-y-3">
            {EQUIPE.map((m) => (
              <li key={m.nome} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/10 text-xs font-semibold text-violet-300">
                  {m.nome[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{m.nome}</p>
                  <p className="text-xs text-zinc-500">{m.papel}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Dados do sistema" className="xl:col-span-2">
          {supabaseConfigurado ? (
            <>
              <p className="text-xs text-zinc-500">
                <span className="font-medium text-emerald-400">Conectado ao Supabase.</span>{" "}
                Os dados são compartilhados por toda a equipe. Para recriar os dados de
                demonstração, rode o <span className="font-mono">database/seed.sql</span> no
                SQL Editor do Supabase (instruções no README) — por segurança, o sistema não
                apaga nem recria dados do banco pela interface.
              </p>
            </>
          ) : (
            <>
              <p className="text-xs text-zinc-500">
                <span className="font-medium text-amber-400">Modo demonstração (local).</span>{" "}
                O Supabase não está configurado, então os dados vivem no navegador
                (localStorage) e não são compartilhados. Configure o{" "}
                <span className="font-mono">.env.local</span> para conectar ao banco real.
                Para voltar ao estado inicial de demonstração:
              </p>
              <Button
                variant="danger"
                className="mt-3"
                onClick={() => {
                  if (window.confirm("Apagar todas as alterações e restaurar os dados de demonstração?")) {
                    resetStore();
                  }
                }}
              >
                <RotateCcw size={14} /> Restaurar dados de demonstração
              </Button>
            </>
          )}
        </Card>

        <Card title="Integrações" className="xl:col-span-2">
          <p className="mb-4 text-xs text-zinc-500">
            Nenhuma integração está ativa nesta versão. O sistema roda 100% com
            dados mockados — esta lista mapeia o roadmap de conexões reais.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTEGRACOES.map((i) => (
              <div
                key={i.nome}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-200">{i.nome}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{i.descricao}</p>
                </div>
                <Badge tone="gray">Em breve</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
