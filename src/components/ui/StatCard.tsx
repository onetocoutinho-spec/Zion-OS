import { type LucideIcon } from "lucide-react";
import { Tone } from "@/lib/status";

const ICON_STYLES: Record<Tone, string> = {
  green: "bg-emerald-500/10 text-emerald-400",
  yellow: "bg-amber-500/10 text-amber-400",
  red: "bg-red-500/10 text-red-400",
  blue: "bg-sky-500/10 text-sky-400",
  violet: "bg-violet-500/10 text-violet-400",
  orange: "bg-orange-500/10 text-orange-400",
  cyan: "bg-cyan-500/10 text-cyan-400",
  gray: "bg-zinc-500/10 text-zinc-400",
};

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: Tone;
}

export function StatCard({ label, value, hint, icon: Icon, tone = "violet" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#0e0e16] p-4 transition-colors hover:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs text-zinc-500">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-white">
            {value}
          </p>
          {hint && <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>}
        </div>
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${ICON_STYLES[tone]}`}
        >
          <Icon size={17} />
        </div>
      </div>
    </div>
  );
}
