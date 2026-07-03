import { Tone, toneFor } from "@/lib/status";

const TONE_STYLES: Record<Tone, string> = {
  green: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  yellow: "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  red: "bg-red-500/10 text-red-400 ring-red-500/20",
  blue: "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  violet: "bg-violet-500/10 text-violet-400 ring-violet-500/20",
  orange: "bg-orange-500/10 text-orange-400 ring-orange-500/20",
  cyan: "bg-cyan-500/10 text-cyan-400 ring-cyan-500/20",
  gray: "bg-zinc-500/10 text-zinc-400 ring-zinc-500/20",
};

interface BadgeProps {
  children: string;
  /** Se omitido, o tom é deduzido do texto (status conhecidos do sistema). */
  tone?: Tone;
}

export function Badge({ children, tone }: BadgeProps) {
  const resolved = tone ?? toneFor(children);
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE_STYLES[resolved]}`}
    >
      {children}
    </span>
  );
}
