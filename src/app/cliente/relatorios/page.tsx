"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarRelatoriosDoCliente } from "@/lib/services/relatorios";
import { listarAnunciosGeradosDoCliente } from "@/lib/services/anunciosGerados";
import { listarProdutos } from "@/lib/services/produtos";
import { toneFor } from "@/lib/status";
import type { Relatorio } from "@/lib/types";

export default function ClienteRelatorios() {
  const { clienteId } = useClientPortal();
  const { data: relatorios } = useLiveQuery(
    () => listarRelatoriosDoCliente(clienteId),
    [clienteId]
  );
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(clienteId),
    [clienteId]
  );
  const { data: produtos } = useLiveQuery(listarProdutos);

  const [aberto, setAberto] = useState<string | null>(null);

  // Resumo "ao vivo" derivado dos dados atuais (não depende de relatório salvo).
  const vivo = useMemo(() => {
    const ans = anuncios ?? [];
    const otimizados = ans.filter((a) => a.status === "aprovado" || a.status === "publicado").length;
    const corrigidos = ans.filter((a) => a.qtdPendencias === 0 && a.notaDiagnostico >= 70).length;
    return {
      produtos: (produtos ?? []).length,
      otimizados,
      corrigidos,
      emRevisao: ans.filter(
        (a) => a.status === "aguardando_aprovacao" || a.status === "rascunho"
      ).length,
    };
  }, [anuncios, produtos]);

  const lista = relatorios ?? [];

  return (
    <>
      <PageHeader
        titulo="Relatórios"
        subtitulo="Acompanhe o que foi feito na sua loja e o que ainda precisa de atenção."
      />

      {/* Resumo ao vivo */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Produtos na base" value={vivo.produtos} icon={FileText} tone="blue" />
        <StatCard label="Anúncios otimizados" value={vivo.otimizados} icon={CheckCircle2} tone="green" />
        <StatCard label="Anúncios corrigidos" value={vivo.corrigidos} icon={Sparkles} tone="violet" />
        <StatCard
          label="Aguardando revisão"
          value={vivo.emRevisao}
          icon={AlertTriangle}
          tone={vivo.emRevisao ? "yellow" : "gray"}
        />
      </div>

      {lista.length === 0 ? (
        <VazioAmigavel
          icon={FileText}
          titulo="Nenhum relatório publicado ainda"
          descricao="A equipe Zion publica relatórios periódicos com o que foi feito e os próximos passos. Enquanto isso, o resumo acima acompanha sua loja em tempo real."
        />
      ) : (
        <div className="space-y-3">
          {lista.map((r) => (
            <RelatorioCard
              key={r.id}
              relatorio={r}
              aberto={aberto === r.id}
              onToggle={() => setAberto(aberto === r.id ? null : r.id)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function RelatorioCard({
  relatorio: r,
  aberto,
  onToggle,
}: {
  relatorio: Relatorio;
  aberto: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-zinc-100">{r.periodo || "Relatório"}</p>
            <Pill tone={toneFor(r.status)}>{r.status}</Pill>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            {r.produtosTrabalhados} produtos trabalhados · {r.anunciosRevisados} anúncios revisados
          </p>
        </div>
        <button
          onClick={onToggle}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-300 hover:border-white/20"
        >
          {aberto ? "Fechar" : "Visualizar"}
          <ChevronDown size={12} className={`transition-transform ${aberto ? "rotate-180" : ""}`} />
        </button>
      </div>

      {aberto && (
        <div className="mt-4 space-y-4 border-t border-white/5 pt-4">
          <Trecho titulo="O que foi feito" texto={r.oQueFoiFeito} />
          <Trecho titulo="O que precisa de atenção" texto={r.problemasEncontrados} tone="amber" />
          <Trecho titulo="Oportunidades" texto={r.oportunidades} />
          <Trecho titulo="Pendências" texto={r.pendencias} tone="amber" />
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-violet-400">
              <ArrowRight size={12} /> Próximas ações
            </p>
            <p className="whitespace-pre-line text-sm text-zinc-300">{r.proximasAcoes || "—"}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

function Trecho({ titulo, texto, tone }: { titulo: string; texto: string; tone?: "amber" }) {
  return (
    <div>
      <p
        className={`mb-1 text-[11px] uppercase tracking-wider ${
          tone === "amber" ? "text-amber-400" : "text-zinc-500"
        }`}
      >
        {titulo}
      </p>
      <p className="whitespace-pre-line text-sm text-zinc-300">{texto || "—"}</p>
    </div>
  );
}
