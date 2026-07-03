import { Inbox } from "lucide-react";
import { LinkButton } from "./Button";

interface EmptyStateProps {
  mensagem: string;
  acaoLabel?: string;
  acaoHref?: string;
  compacto?: boolean;
}

/** Estado vazio com mensagem útil e ação opcional de criação. */
export function EmptyState({ mensagem, acaoLabel, acaoHref, compacto }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-center ${
        compacto ? "py-6" : "py-12"
      }`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.04] text-zinc-500">
        <Inbox size={18} />
      </div>
      <p className="text-sm text-zinc-500">{mensagem}</p>
      {acaoLabel && acaoHref && (
        <LinkButton href={acaoHref} variant="ghost">
          {acaoLabel}
        </LinkButton>
      )}
    </div>
  );
}
