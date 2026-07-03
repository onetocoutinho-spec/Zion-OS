"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Play, Link2, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Badge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AREAS_AGENTE, IMPLANTACAO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import { listarAgentes, registrarExecucao } from "@/lib/services/agentes";
import type { AgenteIA } from "@/lib/types";

export default function AgentesPage() {
  const [area, setArea] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [executado, setExecutado] = useState<string | null>(null);
  const { data: agentes } = useLiveQuery(listarAgentes);

  const filtrados = (agentes ?? []).filter(
    (a) =>
      (area === "Todos" || a.area === area) &&
      (status === "Todos" || a.statusImplantacao === status)
  );

  // Registra a execução simulada no histórico do agente
  async function executar(agente: AgenteIA) {
    await registrarExecucao(agente);
    setExecutado(agente.id);
    setTimeout(() => setExecutado(null), 2000);
  }

  return (
    <div>
      <PageHeader
        title="Agentes IA"
        description="Time de agentes da Zion Company. Clique no nome para ver a definição completa e o histórico."
        count={filtrados.length}
        countLabel="agentes"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          <FilterSelect label="Área" value={area} options={AREAS_AGENTE} onChange={setArea} />
          <FilterSelect label="Implantação" value={status} options={IMPLANTACAO_STATUS} onChange={setStatus} />
        </div>
        <LinkButton href="/agentes/novo">
          <Plus size={14} /> Novo agente
        </LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {filtrados.map((a) => (
          <div
            key={a.id}
            className="flex flex-col rounded-xl border border-white/5 bg-[#0e0e16] p-5 transition-colors hover:border-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <Link href={`/agentes/${a.id}`} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <Bot size={18} />
                </div>
                <div>
                  <p className="font-medium text-zinc-100 hover:text-violet-300">{a.nome}</p>
                  <p className="text-xs text-zinc-500">{a.area}</p>
                </div>
              </Link>
              <Badge>{a.statusImplantacao}</Badge>
            </div>

            <p className="mt-4 flex-1 text-sm text-zinc-300">{a.objetivo}</p>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Uso: {a.frequenciaUso}</span>
              {a.agentesConectados.length > 0 && (
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <Link2 size={11} />
                  {a.agentesConectados.join(", ")}
                </span>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => executar(a)}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  executado === a.id
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-violet-600 text-white hover:bg-violet-500"
                }`}
              >
                <Play size={14} />
                {executado === a.id ? "Registrado no histórico ✓" : "Executar agente"}
              </button>
              <Link
                href={`/agentes/${a.id}`}
                className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
              >
                Detalhes
              </Link>
            </div>
          </div>
        ))}
      </div>

      {agentes && filtrados.length === 0 && (
        <EmptyState
          mensagem="Nenhum agente encontrado com os filtros atuais."
          acaoLabel="Criar agente"
          acaoHref="/agentes/novo"
        />
      )}
    </div>
  );
}
