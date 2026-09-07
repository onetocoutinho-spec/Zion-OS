"use client";

// A célula de custo quando há DUAS OU MAIS fontes discordando.
//
// Diferente de `ResolverAmbiguos` (a caixa cheia que aparece uma vez, logo
// depois da importação), esta é a versão de CÉLULA DE TABELA: compacta,
// porque mora ao lado de "Fonte", "Atualizado em" e "SKUs" na mesma linha, e
// PERSISTENTE — continua aqui em qualquer sessão até alguém decidir, porque a
// pendência agora sobrevive à importação (migração 087).
//
// A pessoa que decide não precisa se limitar aos candidatos: pode saber que
// nenhuma das fontes está certa. Por isso o "outro valor" reusa `CustoEditavel`
// inteiro — com a mesma recusa de referência de modelo e de custo maior que
// cem vezes o preço — em vez de um segundo campo de texto sem essa guarda.

import { useState } from "react";
import { formatBRLExato } from "@/lib/format";
import { CustoEditavel } from "./CustoEditavel";
import type { CandidatoDeCusto } from "@/modules/catalog/domain/custosDoCatalogo";

interface Props {
  nome: string;
  precoVenda: number;
  candidatos: readonly CandidatoDeCusto[];
  /** Grava o custo escolhido — de um dos candidatos ou digitado à parte. */
  onEscolher: (custo: number) => Promise<void>;
}

export function EscolhaDeCustoConflitante({ nome, precoVenda, candidatos, onEscolher }: Props) {
  const [gravando, setGravando] = useState<number | null>(null);

  async function escolher(custo: number) {
    if (gravando !== null) return;
    setGravando(custo);
    try {
      await onEscolher(custo);
    } finally {
      setGravando(null);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="flex flex-wrap gap-1">
        {candidatos.map((c) => (
          <button
            key={`${c.custo}-${c.origem}`}
            type="button"
            disabled={gravando !== null}
            onClick={() => void escolher(c.custo)}
            title={`Fonte: ${c.origem}`}
            className="rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-2 py-1 text-left text-xs text-amber-200 transition-colors hover:border-amber-500/50 disabled:opacity-50 [@media(pointer:coarse)]:min-h-11"
          >
            <span className="font-semibold">{formatBRLExato(c.custo)}</span>
            <span className="ml-1.5 max-w-[9rem] truncate text-[10px] text-amber-200/60">
              {c.origem}
            </span>
          </button>
        ))}
      </div>
      <CustoEditavel nome={nome} custo={0} precoVenda={precoVenda} onGravar={escolher} />
    </div>
  );
}
