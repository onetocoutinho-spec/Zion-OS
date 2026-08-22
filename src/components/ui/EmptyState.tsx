import { Inbox, type LucideIcon } from "lucide-react";
import { LinkButton } from "./Button";

// O ESTADO VAZIO — um só. Havia quatro formas (EmptyState, VazioAmigavel,
// EmptyRow e duas caixas tracejadas inline); as variações viraram props
// (docs/product/ux/07-COMPONENT-IMPACT.md, "Consolidados").
//
// Um vazio bom explica o que a tela faz e oferece a primeira ação — é parte
// do onboarding, não um "nada encontrado".

interface EmptyStateProps {
  mensagem: string;
  /** Título curto acima da mensagem (forma "amigável" do portal). */
  titulo?: string;
  /** Ícone temático; padrão: caixa de entrada. */
  icon?: LucideIcon;
  acaoLabel?: string;
  acaoHref?: string;
  /** Ação arbitrária (botão, formulário) no lugar do link. */
  acao?: React.ReactNode;
  compacto?: boolean;
  /** Caixa tracejada em volta — para vazios que ocupam a tela inteira. */
  moldura?: boolean;
}

/** Estado vazio com mensagem útil e ação opcional de criação. */
export function EmptyState({
  mensagem,
  titulo,
  icon: Icon = Inbox,
  acaoLabel,
  acaoHref,
  acao,
  compacto,
  moldura,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 text-center ${compacto ? "py-6" : "py-12"} ${
        moldura ? "rounded-xl border border-dashed border-white/10 bg-surface-raised px-6" : ""
      }`}
    >
      <div
        className={`flex items-center justify-center ${
          titulo ? "h-12 w-12 rounded-xl bg-violet-500/10 text-violet-400" : "h-10 w-10 rounded-full bg-white/[0.04] text-zinc-500"
        }`}
      >
        <Icon size={titulo ? 22 : 18} />
      </div>
      {titulo && <p className="text-sm font-medium text-zinc-200">{titulo}</p>}
      <p className={`max-w-sm text-sm leading-relaxed text-zinc-500 ${titulo ? "-mt-2 text-xs" : ""}`}>{mensagem}</p>
      {acao}
      {!acao && acaoLabel && acaoHref && (
        <LinkButton href={acaoHref} variant="ghost">
          {acaoLabel}
        </LinkButton>
      )}
    </div>
  );
}
