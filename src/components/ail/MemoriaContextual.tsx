"use client";

// Memória Contextual (E4.1) — o componente de assistência à decisão.
//
// Renderizado DENTRO de um formulário de decisão real, responde em segundos:
// "já fizemos isso antes? o que normalmente fazemos? quão confiável? quem?".
// SILENCIOSO quando não há memória (a tela fica exatamente como hoje —
// aditividade, RFC-AIL-005 §6.2). NUNCA escreve no campo, NUNCA tem botão de
// aplicar: sugestão é EVIDÊNCIA, nunca comando — o humano sempre decide.

import Link from "next/link";
import { useCallback } from "react";
import { Brain, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useLiveQuery } from "@/lib/hooks";
import {
  localizarMemoria,
  propostaSegue,
} from "@/modules/adaptive-intelligence/application/pattern-matching";

const TOM_CONFIDENCE = { observado: "gray", recorrente: "blue", consistente: "green" } as const;

interface MemoriaContextualProps {
  /** clienteId (tenant). Sem cliente selecionado, o componente não consulta. */
  empresa: string | null | undefined;
  contexto: string;
  campo: string;
  /** O valor atualmente no campo — comparado localmente (sem refetch por tecla). */
  proposta?: string;
}

function dataCurta(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString("pt-BR");
}

export function MemoriaContextual({ empresa, contexto, campo, proposta }: MemoriaContextualProps) {
  const consulta = useCallback(
    () =>
      empresa
        ? localizarMemoria({ empresa, contexto, campo })
        : Promise.resolve(null),
    [empresa, contexto, campo]
  );
  const { data: memoria } = useLiveQuery(consulta, [empresa, contexto, campo]);

  // Silêncio = a tela de hoje. Sem memória não há nada a revelar.
  if (!memoria?.encontrada || !memoria.maisFrequente) return null;
  const top = memoria.maisFrequente;
  const segue = propostaSegue(proposta, { campo: top.campo, valor: top.valor });

  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-medium text-violet-300">
          <Brain size={13} /> Já fizemos isso antes
        </span>
        <span className="text-zinc-400">
          {top.ocorrencias === 1 ? "1 decisão registrada" : `${top.ocorrencias} decisões registradas`}
          {" — mais frequente:"}
        </span>
        <span className="font-mono text-zinc-100">{top.valor}</span>
        <Badge tone={TOM_CONFIDENCE[top.confidence]}>{top.confidence}</Badge>
        {memoria.emDisputa && <Badge tone="orange">em disputa</Badge>}
        <Link
          href={`/ail/padroes/${top.id}`}
          className="ml-auto font-medium text-sky-400 hover:text-sky-300"
        >
          Por quê? Ver evidências →
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-zinc-500">
        <span>
          última em {dataCurta(top.ultimaOcorrencia)} · por {top.ultimoAutor}
        </span>
        {segue === true && <span className="text-emerald-400/90">· sua proposta segue a memória</span>}
        {segue === false && (
          <span className="flex items-center gap-1 text-amber-400/90">
            <AlertTriangle size={11} /> · difere do mais frequente (a decisão é sua)
          </span>
        )}
      </div>
    </div>
  );
}
