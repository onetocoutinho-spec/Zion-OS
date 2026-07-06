"use client";

import { LogOut, Package, Workflow, CheckCircle2, Send, CalendarDays, Sparkles } from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useLiveQuery } from "@/lib/hooks";
import { getSupabase } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import {
  portalResumo,
  portalProximasAcoes,
  portalAnuncios,
  type Perfil,
} from "@/lib/services/perfil";

// Rótulos amigáveis para o cliente (esconde o jargão interno).
const STATUS_ANUNCIO: Record<string, { texto: string; tone: "gray" | "blue" | "yellow" | "green" | "violet" | "orange" }> = {
  rascunho: { texto: "Em produção", tone: "blue" },
  aguardando_aprovacao: { texto: "Em revisão final", tone: "yellow" },
  aprovado: { texto: "Aprovado", tone: "green" },
  publicado: { texto: "Publicado", tone: "violet" },
  rejeitado: { texto: "Em ajuste", tone: "orange" },
};

export function PortalApp({ perfil }: { perfil: Perfil }) {
  const { data: resumo } = useLiveQuery(portalResumo);
  const { data: acoes } = useLiveQuery(portalProximasAcoes);
  const { data: anuncios } = useLiveQuery(portalAnuncios);

  const nome = resumo?.cliente || perfil.nome || "sua loja";

  async function sair() {
    await getSupabase().auth.signOut();
  }

  return (
    <div className="min-h-screen bg-[#08080d] text-zinc-200">
      {/* Cabeçalho */}
      <header className="border-b border-white/5 bg-[#0b0b12]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{nome}</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-500">Portal · Zion Company</p>
            </div>
          </div>
          <button
            onClick={sair}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">A sua operação, em tempo real</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Acompanhe o que a Zion está fazendo pela sua loja — do cadastro até a publicação.
          </p>
        </div>

        {/* Resumo */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Produtos na base" value={resumo?.totalProdutos ?? 0} icon={Package} tone="blue" hint="Cadastrados no Zion OS" />
          <StatCard label="Em produção" value={resumo?.emProducao ?? 0} icon={Workflow} tone="violet" hint="Anúncios sendo otimizados" />
          <StatCard label="Aprovados" value={resumo?.aprovados ?? 0} icon={CheckCircle2} tone="green" hint="Prontos para publicar" />
          <StatCard label="Publicados" value={resumo?.publicados ?? 0} icon={Send} tone="cyan" hint="No ar no marketplace" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Próximas ações */}
          <Card title="O que está em andamento">
            {resumo?.proximaAcao && (
              <div className="mb-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <p className="text-[11px] uppercase tracking-wider text-violet-300">Foco atual</p>
                <p className="mt-0.5 text-sm text-zinc-200">{resumo.proximaAcao}</p>
              </div>
            )}
            {acoes && acoes.length > 0 ? (
              <ul className="space-y-3">
                {acoes.map((a, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200">{a.proxima_acao || a.tarefa}</p>
                      {a.prazo && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
                          <CalendarDays size={11} /> previsto para {formatDate(a.prazo)}
                        </p>
                      )}
                    </div>
                    <Badge>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Nenhuma ação pendente no momento. ✨</p>
            )}
          </Card>

          {/* Anúncios trabalhados */}
          <Card title="Anúncios sendo trabalhados">
            {anuncios && anuncios.length > 0 ? (
              <ul className="max-h-96 space-y-2.5 overflow-y-auto pr-1">
                {anuncios.map((an, i) => {
                  const s = STATUS_ANUNCIO[an.status] ?? { texto: an.status, tone: "gray" as const };
                  return (
                    <li key={i} className="flex items-start justify-between gap-3 border-b border-white/[0.04] pb-2.5 last:border-0">
                      <p className="min-w-0 text-sm text-zinc-300">{an.titulo}</p>
                      <Badge tone={s.tone}>{s.texto}</Badge>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">
                Os anúncios aparecem aqui conforme a Zion produz e revisa cada um.
              </p>
            )}
          </Card>
        </div>

        <p className="pt-2 text-center text-xs text-zinc-600">
          Zion Company · painel de acompanhamento do cliente (somente leitura)
        </p>
      </main>
    </div>
  );
}
