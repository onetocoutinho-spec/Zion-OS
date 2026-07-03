"use client";

import { useState } from "react";
import { Bot, Play, Link2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Badge } from "@/components/ui/Badge";
import { agentes } from "@/lib/data/agentes";

const AREAS = [...new Set(agentes.map((a) => a.area))];
const STATUS = ["Ativo", "Em teste", "Planejado"];

export default function AgentesPage() {
  const [area, setArea] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [executado, setExecutado] = useState<string | null>(null);

  const filtrados = agentes.filter(
    (a) =>
      (area === "Todos" || a.area === area) &&
      (status === "Todos" || a.statusImplantacao === status)
  );

  // Botão visual: ainda não executa nada de verdade, apenas simula o clique.
  function executar(id: string) {
    setExecutado(id);
    setTimeout(() => setExecutado(null), 2000);
  }

  return (
    <div>
      <PageHeader
        title="Agentes IA"
        description="Time de agentes da Zion Company e onde cada um entra na operação."
        count={filtrados.length}
        countLabel="agentes"
      />

      <div className="mb-4 flex flex-wrap gap-4">
        <FilterSelect label="Área" value={area} options={AREAS} onChange={setArea} />
        <FilterSelect label="Implantação" value={status} options={STATUS} onChange={setStatus} />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 2xl:grid-cols-3">
        {filtrados.map((a) => (
          <div
            key={a.id}
            className="flex flex-col rounded-xl border border-white/5 bg-[#0e0e16] p-5 transition-colors hover:border-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400">
                  <Bot size={18} />
                </div>
                <div>
                  <p className="font-medium text-zinc-100">{a.nome}</p>
                  <p className="text-xs text-zinc-500">{a.area}</p>
                </div>
              </div>
              <Badge>{a.statusImplantacao}</Badge>
            </div>

            <p className="mt-4 text-sm text-zinc-300">{a.objetivo}</p>

            <dl className="mt-4 space-y-2.5 text-xs">
              <div>
                <dt className="font-semibold uppercase tracking-wider text-zinc-500">Quando usar</dt>
                <dd className="mt-0.5 text-zinc-400">{a.quandoUsar}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-zinc-500">Entrada</dt>
                <dd className="mt-0.5 text-zinc-400">{a.entradaNecessaria}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-zinc-500">Saída</dt>
                <dd className="mt-0.5 text-zinc-400">{a.saidaEsperada}</dd>
              </div>
              <div>
                <dt className="font-semibold uppercase tracking-wider text-zinc-500">Prompt resumido</dt>
                <dd className="mt-0.5 rounded-lg bg-white/[0.03] p-2 font-mono text-[11px] leading-relaxed text-zinc-400">
                  {a.promptResumido}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-zinc-500">Uso: {a.frequenciaUso}</span>
              {a.agentesConectados.length > 0 && (
                <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <Link2 size={11} />
                  {a.agentesConectados.join(", ")}
                </span>
              )}
            </div>

            <button
              onClick={() => executar(a.id)}
              className={`mt-4 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                executado === a.id
                  ? "bg-emerald-500/15 text-emerald-400"
                  : "bg-violet-600 text-white hover:bg-violet-500"
              }`}
            >
              <Play size={14} />
              {executado === a.id ? "Execução simulada ✓" : "Executar agente"}
            </button>
          </div>
        ))}
      </div>

      {filtrados.length === 0 && (
        <p className="py-10 text-center text-sm text-zinc-500">
          Nenhum agente encontrado com os filtros atuais.
        </p>
      )}
    </div>
  );
}
