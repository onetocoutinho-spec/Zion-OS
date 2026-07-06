"use client";

// Primitivas visuais do Portal do Cliente — linguagem simples, visual premium.
// Reaproveitam o mesmo dark theme do app, mas com componentes mais amigáveis.

import Link from "next/link";
import { type LucideIcon, ArrowRight } from "lucide-react";
import { type Tone } from "@/lib/status";

const TONE_BG: Record<Tone, string> = {
  green: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  yellow: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  red: "bg-red-500/10 text-red-400 ring-red-500/20",
  blue: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  violet: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
  orange: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  cyan: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20",
  gray: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
};

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

/** Etiqueta colorida de status. */
export function Pill({ children, tone = "gray" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_BG[tone]}`}
    >
      {children}
    </span>
  );
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
    <div className="group flex h-full items-start gap-3 rounded-xl border border-white/5 bg-[#0e0e16] p-4 text-left transition-colors hover:border-violet-500/30 hover:bg-white/[0.02]">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${TONE_BG[tone]}`}
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

/** Estado vazio amigável. */
export function VazioAmigavel({
  icon: Icon,
  titulo,
  descricao,
  acao,
}: {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0e0e16] px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
        <Icon size={22} />
      </div>
      <p className="mt-3 text-sm font-medium text-zinc-200">{titulo}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-zinc-500">{descricao}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  );
}
