"use client";

// A rede de baixo: erro em qualquer tela FORA do portal do cliente.
//
// O `/cliente/error.tsx` cobre as 17 telas do portal e as cobre melhor, porque
// ali a casca sobrevive. Este aqui pega o resto — o painel da equipe, o
// onboarding, a definição de senha — onde não há uma casca em comum para
// preservar. Sem ele, qualquer um desses erros vira a tela do Next em inglês.

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function ErroNaAplicacao({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro na aplicação:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-xl border border-amber-400/20 bg-amber-400/5 p-6 text-center">
        <AlertTriangle size={22} className="mx-auto text-amber-300" />
        <p className="mt-3 text-sm font-medium text-amber-100">Algo quebrou nesta tela.</p>
        <p className="mt-1.5 text-sm text-amber-200/70">
          Tentar de novo costuma resolver. Se não resolver, o código abaixo diz o que
          aconteceu para quem pode consertar.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-amber-200/50">código: {error.digest}</p>
        )}

        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg border border-amber-400/30 px-3 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-400/10 [@media(pointer:coarse)]:min-h-11"
        >
          <RotateCw size={14} /> Tentar de novo
        </button>
      </div>
    </div>
  );
}
