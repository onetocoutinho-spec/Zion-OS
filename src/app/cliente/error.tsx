"use client";

// Quando uma tela do portal quebra de verdade.
//
// ===========================================================================
// O QUE MUDA COM ESTE ARQUIVO
// ===========================================================================
//
// Sem ele, um erro não tratado sobe até a raiz e o Next troca a APLICAÇÃO
// INTEIRA pela página de erro dele: sidebar, cabeçalho e assistente somem, e
// sobra uma tela branca em inglês. A lojista perde a navegação junto com a
// tela, e o único caminho de volta é o botão do navegador.
//
// Estando aqui, o erro fica contido no segmento `/cliente/*`: a casca continua
// desenhada, o menu continua clicável, e quem tropeçou em uma tela pode ir para
// outra sem recarregar nada.
//
// `error.tsx` é obrigatoriamente um Client Component — é ele que recebe o
// `reset` e precisa de um `onClick`.

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ErroNaTelaDoPortal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O `digest` é o que liga esta tela ao log do servidor: em produção a
    // mensagem real é omitida do navegador de propósito, e sem o digest não há
    // como casar "quebrou para mim" com a linha do log.
    console.error("Erro na tela do portal:", error);
  }, [error]);

  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-6">
      <p className="flex items-center gap-2 text-sm font-medium text-amber-200">
        <AlertTriangle size={16} className="shrink-0" />
        Esta tela não abriu.
      </p>

      {/* O tom é o mesmo da `Superficie`: a lojista não errou nada, e a tela
          não some do menu — ela pode seguir para outra e voltar depois. */}
      <p className="mt-2 max-w-prose text-sm text-amber-200/70">
        O resto do portal continua funcionando: use o menu para ir a outra tela.
        Se insistir, mande o código abaixo para quem pode resolver.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-xs text-amber-200/50">
          código: {error.digest}
        </p>
      )}

      <Button variant="ghost" onClick={reset} className="mt-4">
        <RotateCw size={14} /> Tentar de novo
      </Button>
    </div>
  );
}
