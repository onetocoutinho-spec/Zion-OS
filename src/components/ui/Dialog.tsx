"use client";

// A PRIMITIVA DE DIÁLOGO — uma só, para o produto inteiro.
//
// Antes havia três modais escritos à mão (ModalPublicar, PainelDoAssistente,
// Mission) e oito `fixed inset-0` soltos; só um deles declarava `aria-modal`,
// nenhum prendia o foco, e o Esc fechava uns e não outros. Este componente
// reúne o comportamento que todos deviam ter e deixa para cada uso só o
// conteúdo: (docs/product/ux/07-COMPONENT-IMPACT.md, "Dialog")
//
//   * `role="dialog"` + `aria-modal` + `aria-labelledby`;
//   * foco vai para dentro ao abrir e VOLTA para quem abriu ao fechar;
//   * Tab/Shift+Tab circulam só dentro do diálogo;
//   * Esc e clique no fundo fecham (o clique no fundo pode ser desligado para
//     confirmações destrutivas);
//   * o scroll da página trava enquanto aberto;
//   * no celular ocupa a tela quase inteira, por baixo (bottom sheet).

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

interface DialogProps {
  aberto: boolean;
  aoFechar: () => void;
  titulo: ReactNode;
  descricao?: ReactNode;
  children: ReactNode;
  /** Largura máxima no desktop. Padrão: `md`. */
  tamanho?: "sm" | "md" | "lg";
  /** Desliga o fechar-ao-clicar-no-fundo (confirmações destrutivas). */
  fundoNaoFecha?: boolean;
  /** Esconde o botão de fechar do cabeçalho (quando o conteúdo tem o seu). */
  semBotaoFechar?: boolean;
}

const LARGURA = { sm: "sm:max-w-md", md: "sm:max-w-2xl", lg: "sm:max-w-4xl" } as const;

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  aberto,
  aoFechar,
  titulo,
  descricao,
  children,
  tamanho = "md",
  fundoNaoFecha = false,
  semBotaoFechar = false,
}: DialogProps) {
  const caixa = useRef<HTMLDivElement>(null);
  const idTitulo = useId();
  const idDescricao = useId();

  useEffect(() => {
    if (!aberto) return;
    const quemAbriu = document.activeElement as HTMLElement | null;
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Foco entra: no primeiro campo/botão do conteúdo, ou na própria caixa.
    const primeiro = caixa.current?.querySelector<HTMLElement>(FOCAVEIS);
    (primeiro ?? caixa.current)?.focus();

    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        aoFechar();
        return;
      }
      if (e.key !== "Tab" || !caixa.current) return;
      const focaveis = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
      if (focaveis.length === 0) {
        e.preventDefault();
        return;
      }
      const primeiroF = focaveis[0];
      const ultimoF = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiroF) {
        e.preventDefault();
        ultimoF.focus();
      } else if (!e.shiftKey && document.activeElement === ultimoF) {
        e.preventDefault();
        primeiroF.focus();
      }
    }
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflowAnterior;
      quemAbriu?.focus?.();
    };
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={fundoNaoFecha ? undefined : aoFechar}
        aria-hidden="true"
      />
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={descricao ? idDescricao : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-white/10 bg-surface-raised outline-none sm:max-h-[85vh] sm:rounded-xl ${LARGURA[tamanho]}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-5 py-3">
          <div className="min-w-0">
            <p id={idTitulo} className="text-sm font-semibold text-white">
              {titulo}
            </p>
            {descricao && (
              <p id={idDescricao} className="mt-0.5 text-xs text-zinc-500">
                {descricao}
              </p>
            )}
          </div>
          {!semBotaoFechar && (
            <button
              type="button"
              onClick={aoFechar}
              aria-label="Fechar"
              className="-mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-white [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
            >
              <X size={18} />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
