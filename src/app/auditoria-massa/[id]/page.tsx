"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ExternalLink,
  ListPlus,
  CheckCircle2,
  EyeOff,
  ArrowLeft,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveQuery } from "@/lib/hooks";
import { buscarAuditoria, alterarStatusAuditoria } from "@/lib/services/auditorias";
import { listarProblemasDaAuditoria } from "@/lib/services/problemasAnuncio";
import { enviarAuditoriaParaFila } from "@/lib/services/filaOtimizacao";
import { formatBRL } from "@/lib/format";
import {
  ROTULO_PRIORIDADE,
  ROTULO_STATUS_AUDITORIA,
  ROTULO_GRAVIDADE,
  ROTULO_STATUS_PROBLEMA,
  ROTULO_TIPO_PROBLEMA,
} from "@/lib/auditoria";
import type { Tone } from "@/lib/status";
import type { ClassificacaoABC, PrioridadeAuditoria } from "@/lib/types";

const TONE_ABC: Record<ClassificacaoABC, Tone> = { A: "green", B: "blue", C: "gray" };
const TONE_PRIORIDADE: Record<PrioridadeAuditoria, Tone> = {
  critica: "red",
  alta: "orange",
  media: "blue",
  baixa: "gray",
};

function corScore(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 55) return "text-amber-400";
  return "text-red-400";
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="shrink-0 text-zinc-500">{label}</dt>
      <dd className="text-right text-zinc-200">{children}</dd>
    </div>
  );
}

export default function AuditoriaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const { data: auditoria, carregando } = useLiveQuery(() => buscarAuditoria(id), [id]);
  const { data: problemasData } = useLiveQuery(() => listarProblemasDaAuditoria(id), [id]);
  const problemas = problemasData ?? [];

  if (carregando) return null;
  if (!auditoria)
    return (
      <EmptyState
        mensagem="Auditoria não encontrada."
        acaoLabel="Voltar para Auditoria em Massa"
        acaoHref="/auditoria-massa"
      />
    );

  async function enviarParaFila() {
    if (!auditoria) return;
    setBusy(true);
    try {
      await enviarAuditoriaParaFila(
        auditoria,
        auditoria.prioridade === "critica" ? "otimizar_completo" : "revisar_titulo"
      );
      await alterarStatusAuditoria(auditoria.id, "em_otimizacao");
      router.push("/fila-otimizacao");
    } finally {
      setBusy(false);
    }
  }

  async function marcar(status: "otimizado" | "ignorado") {
    if (!auditoria) return;
    setBusy(true);
    try {
      await alterarStatusAuditoria(auditoria.id, status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/auditoria-massa" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
            <ArrowLeft size={13} /> Auditoria em Massa
          </Link>
          <h1 className="text-xl font-semibold tracking-tight text-white">{auditoria.tituloAtual}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {auditoria.categoria} · {auditoria.cliente} · {auditoria.marketplace}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {auditoria.linkAnuncio && (
            <LinkButton href={auditoria.linkAnuncio} variant="ghost">
              <ExternalLink size={14} /> Abrir anúncio
            </LinkButton>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={enviarParaFila} disabled={busy}>
          <ListPlus size={14} /> Enviar para a fila
        </Button>
        <Button variant="success" onClick={() => marcar("otimizado")} disabled={busy}>
          <CheckCircle2 size={14} /> Marcar otimizado
        </Button>
        <Button variant="ghost" onClick={() => marcar("ignorado")} disabled={busy}>
          <EyeOff size={14} /> Marcar ignorado
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Diagnóstico */}
        <Card title="Diagnóstico" className="lg:col-span-1">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <p className={`text-4xl font-semibold tracking-tight ${corScore(auditoria.scoreQualidade)}`}>
                {auditoria.scoreQualidade}
              </p>
              <p className="text-xs text-zinc-500">score /100</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Badge tone={TONE_ABC[auditoria.classificacaoAbc]}>{`Classe ${auditoria.classificacaoAbc}`}</Badge>
              <Badge tone={TONE_PRIORIDADE[auditoria.prioridade]}>{ROTULO_PRIORIDADE[auditoria.prioridade]}</Badge>
              <Badge>{ROTULO_STATUS_AUDITORIA[auditoria.statusAuditoria]}</Badge>
            </div>
          </div>
          <dl className="mt-4 space-y-2 border-t border-white/5 pt-4">
            <Info label="Agente recomendado">{auditoria.agenteRecomendado || "—"}</Info>
            <Info label="Responsável">{auditoria.responsavel || "—"}</Info>
          </dl>
        </Card>

        {/* Métricas */}
        <Card title="Métricas do anúncio" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3">
            <Info label="Preço">{formatBRL(auditoria.preco)}</Info>
            <Info label="Estoque">{auditoria.estoque}</Info>
            <Info label="Vendas">{auditoria.vendas}</Info>
            <Info label="Visitas">{auditoria.visitas}</Info>
            <Info label="Conversão">{auditoria.conversao.toFixed(1)}%</Info>
            <Info label="Receita est.">{formatBRL(auditoria.preco * auditoria.vendas)}</Info>
          </dl>
          <div className="mt-4 space-y-3 border-t border-white/5 pt-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Oportunidade</p>
              <p className="mt-1 text-sm text-zinc-300">{auditoria.oportunidades}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Próxima ação</p>
              <p className="mt-1 text-sm text-zinc-300">{auditoria.proximaAcao}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Problemas */}
      <Card title={`Problemas encontrados (${problemas.length})`}>
        {problemas.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum problema detalhado registrado para este anúncio.</p>
        ) : (
          <ul className="divide-y divide-white/[0.04]">
            {problemas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 max-w-2xl">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">{ROTULO_TIPO_PROBLEMA[p.tipoProblema]}</p>
                    <Badge tone={p.gravidade === "critica" ? "red" : p.gravidade === "alta" ? "orange" : "yellow"}>
                      {ROTULO_GRAVIDADE[p.gravidade]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-zinc-400">{p.sugestaoCorrecao}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">Agente: {p.agenteRecomendado}</p>
                </div>
                <Badge>{ROTULO_STATUS_PROBLEMA[p.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
