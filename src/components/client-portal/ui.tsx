"use client";

// Primitivas visuais do Portal do Cliente — linguagem simples, visual premium.
// Reaproveitam o mesmo dark theme do app, mas com componentes mais amigáveis.

import Link from "next/link";
import { type LucideIcon, ArrowRight } from "lucide-react";
import { type Tone } from "@/lib/status";
import { Badge, TONE_STYLES } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

/** Cabeçalho de página: título grande + subtítulo amigável + ação opcional. */
export function PageHeader({
  titulo,
  subtitulo,
  acao,
}: {
  titulo: string;
  subtitulo?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">
          {titulo}
        </h1>
        {subtitulo && <p className="mt-1 text-sm text-zinc-400">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

/** Etiqueta colorida de status — é o `Badge`; o nome fica por compatibilidade. */
export function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: Tone }) {
  return <Badge tone={tone}>{children}</Badge>;
}

/** Botão grande de ação da home ("O que você quer fazer hoje?"). */
export function ActionTile({
  href,
  icon: Icon,
  titulo,
  descricao,
  tone = "violet",
  onClick,
}: {
  href?: string;
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  tone?: Tone;
  onClick?: () => void;
}) {
  const inner = (
    <div className="group flex h-full items-start gap-3 rounded-xl border border-white/5 bg-surface-raised p-4 text-left transition-colors hover:border-violet-500/30 hover:bg-white/[0.02]">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${TONE_STYLES[tone]}`}
      >
        <Icon size={19} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-medium text-zinc-100">
          {titulo}
          <ArrowRight
            size={14}
            className="text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-violet-400"
          />
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{descricao}</p>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="w-full">
      {inner}
    </button>
  );
}

/** Bloco de conteúdo com título de seção. */
export function Section({
  titulo,
  descricao,
  acao,
  children,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">{titulo}</h2>
          {descricao && <p className="text-xs text-zinc-500">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  );
}

/** Estado vazio amigável — é o `EmptyState` com moldura; o nome fica por compatibilidade. */
export function VazioAmigavel({
  icon,
  titulo,
  descricao,
  acao,
}: {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return <EmptyState icon={icon} titulo={titulo} mensagem={descricao} acao={acao} moldura />;
}
