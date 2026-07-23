"use client";

// Pattern Browser (E4.0) — "O que a Zion já sabe hoje?"
// SOMENTE LEITURA: esta tela nunca aprende, nunca decide — só revela o que a
// organização já sabe (projeções `padroes` + `decisoes`).

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveQuery } from "@/lib/hooks";
import {
  carregarSlots,
  type VisaoPadrao,
} from "@/modules/adaptive-intelligence/application/pattern-browser";

const TOM_CONFIDENCE = { observado: "gray", recorrente: "blue", consistente: "green" } as const;

function dataCurta(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString("pt-BR");
}

function LinhaPadrao({ p }: { p: VisaoPadrao }) {
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-white/5 py-2.5 first:border-t-0">
      <span className="min-w-40 font-mono text-sm text-zinc-100">{p.valor}</span>
      <Badge tone={TOM_CONFIDENCE[p.confidence]}>{p.confidence}</Badge>
      <span className="text-xs text-zinc-400">
        {p.ocorrencias} {p.ocorrencias === 1 ? "decisão" : "decisões"}
      </span>
      <span className="text-xs text-zinc-500">última em {dataCurta(p.ultimaOcorrencia)}</span>
      <Link
        href={`/ail/padroes/${p.id}`}
        className="ml-auto text-xs font-medium text-sky-400 hover:text-sky-300"
      >
        Ver evidências →
      </Link>
    </li>
  );
}

export default function PadroesPage() {
  const { data: slots, carregando } = useLiveQuery(carregarSlots);

  const totalPadroes = (slots ?? []).reduce((n, s) => n + s.padroes.length, 0);

  return (
    <div>
      <PageHeader
        title="Memória Organizacional"
        description="O que a Zion já sabe — padrões detectados nas decisões reais da equipe. Somente leitura: esta tela nunca aprende nem decide; toda informação é rastreável até as decisões que a originaram."
        count={totalPadroes}
        countLabel="padrões"
      />

      {!carregando && (slots ?? []).length === 0 && (
        <EmptyState mensagem="Nenhum padrão materializado ainda. A memória cresce com as decisões diárias da operação — e a projeção é executada sob demanda." />
      )}

      <div className="grid gap-4">
        {(slots ?? []).map((slot) => (
          <Card
            key={`${slot.empresa}|${slot.contexto}|${slot.campo}`}
            title={`${slot.contexto} · ${slot.campo}`}
            action={
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">{slot.empresa}</span>
                {slot.emDisputa && (
                  <Badge tone="orange">
                    em disputa
                  </Badge>
                )}
              </div>
            }
          >
            {slot.emDisputa && (
              <p className="mb-3 flex items-center gap-2 text-xs text-amber-400/90">
                <AlertTriangle size={13} />
                Dois ou mais valores recorrem neste assunto — nenhum gradua enquanto a
                contradição durar (nada foi apagado).
              </p>
            )}
            <ul>
              {slot.padroes.map((p) => (
                <LinhaPadrao key={p.id} p={p} />
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
