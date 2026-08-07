"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveQuery } from "@/lib/hooks";
import { buscarGlobal, ResultadoBusca } from "@/lib/services/busca";
import type { Tone } from "@/lib/status";

const TONE_POR_TIPO: Record<ResultadoBusca["tipo"], Tone> = {
  Cliente: "green",
  Produto: "blue",
  "Anúncio": "cyan",
  Agente: "violet",
};

function Resultados() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const { data: resultados, carregando } = useLiveQuery(() => buscarGlobal(q), [q]);

  return (
    <div>
      <PageHeader
        title="Busca"
        description={q ? `Resultados para “${q}”` : "Digite algo no campo de busca do topo."}
        count={resultados?.length}
        countLabel="resultados"
      />

      {!carregando && q.trim().length < 2 && (
        <EmptyState mensagem="Digite pelo menos 2 caracteres para buscar." />
      )}

      {!carregando && q.trim().length >= 2 && resultados && resultados.length === 0 && (
        <EmptyState mensagem={`Nada encontrado para “${q}” em clientes, produtos, anúncios, tarefas ou agentes.`} />
      )}

      <ul className="space-y-2">
        {(resultados ?? []).map((r, i) => (
          <li key={`${r.href}-${i}`}>
            <Link
              href={r.href}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-[#0e0e16] px-4 py-3 transition-colors hover:border-violet-500/30"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Search size={14} className="shrink-0 text-zinc-600" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-200">{r.titulo}</p>
                  <p className="truncate text-xs text-zinc-500">{r.descricao}</p>
                </div>
              </div>
              <Badge tone={TONE_POR_TIPO[r.tipo]}>{r.tipo}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BuscaPage() {
  return (
    <Suspense fallback={null}>
      <Resultados />
    </Suspense>
  );
}
