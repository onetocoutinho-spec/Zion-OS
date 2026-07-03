"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/form";
import { useLiveQuery } from "@/lib/hooks";
import {
  atualizarItemOnboarding,
  criarOnboarding,
  listarOnboardings,
} from "@/lib/services/onboardings";
import { listarClientes } from "@/lib/services/clientes";
import {
  CHECKLIST_ONBOARDING,
  CHECKLIST_STATUS,
  progressoOnboarding,
  statusGeralOnboarding,
} from "@/lib/onboarding";
import type { ChecklistStatus } from "@/lib/types";

const STATUS_GERAL = ["Não iniciado", "Em andamento", "Concluído", "Travado"];

// Cores do "pill" de status de cada item do checklist
const PILL: Record<ChecklistStatus, string> = {
  Pendente: "border-white/10 text-zinc-500",
  "Em andamento": "border-sky-500/30 bg-sky-500/10 text-sky-400",
  Concluído: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  Travado: "border-red-500/30 bg-red-500/10 text-red-400",
};

export default function OnboardingPage() {
  const [status, setStatus] = useState("Todos");
  const [novoCliente, setNovoCliente] = useState("");

  const { data: onboardings } = useLiveQuery(listarOnboardings);
  const { data: clientes } = useLiveQuery(listarClientes);

  const lista = onboardings ?? [];
  const filtrados = lista.filter(
    (o) => status === "Todos" || statusGeralOnboarding(o) === status
  );

  // Clientes que ainda não têm onboarding (para o seletor de criação)
  const semOnboarding = (clientes ?? [])
    .filter((c) => !lista.some((o) => o.clienteId === c.id))
    .map((c) => c.empresa);

  async function iniciarOnboarding() {
    const cliente = (clientes ?? []).find((c) => c.empresa === novoCliente);
    if (!cliente) return;
    await criarOnboarding(cliente.id, cliente.empresa);
    setNovoCliente("");
  }

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Fluxo operacional de entrada de cada cliente. Atualize os itens direto no checklist — o status do cliente acompanha."
        count={filtrados.length}
        countLabel="onboardings"
      />

      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <FilterSelect label="Status geral" value={status} options={STATUS_GERAL} onChange={setStatus} />
        <div className="flex items-center gap-2">
          <Select
            options={semOnboarding}
            placeholder="Iniciar onboarding de…"
            value={novoCliente}
            onChange={(e) => setNovoCliente(e.target.value)}
            className="!w-56"
          />
          <Button onClick={iniciarOnboarding} disabled={!novoCliente}>
            <Plus size={14} /> Iniciar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {filtrados.map((o) => {
          const geral = statusGeralOnboarding(o);
          const progresso = progressoOnboarding(o);
          return (
            <Card
              key={o.id}
              title={o.cliente}
              action={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{progresso}%</span>
                  <Badge>{geral}</Badge>
                </div>
              }
            >
              {/* Barra de progresso */}
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className={`h-full rounded-full transition-all ${
                    geral === "Travado" ? "bg-red-500/70" : "bg-gradient-to-r from-violet-500 to-fuchsia-500"
                  }`}
                  style={{ width: `${progresso}%` }}
                />
              </div>

              {/* Checklist interativo */}
              <ul className="space-y-1">
                {CHECKLIST_ONBOARDING.map((item) => {
                  const valor = o.itens[item.key];
                  return (
                    <li
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-white/[0.02]"
                    >
                      <span
                        className={`text-sm ${
                          valor === "Concluído" ? "text-zinc-500 line-through decoration-zinc-700" : "text-zinc-300"
                        }`}
                      >
                        {item.label}
                      </span>
                      <select
                        value={valor}
                        onChange={(e) =>
                          atualizarItemOnboarding(o.id, item.key, e.target.value as ChecklistStatus)
                        }
                        className={`shrink-0 cursor-pointer rounded-full border bg-transparent px-2 py-0.5 text-[11px] font-medium outline-none transition-colors ${PILL[valor]}`}
                      >
                        {CHECKLIST_STATUS.map((s) => (
                          <option key={s} value={s} className="bg-[#12121c] text-zinc-200">
                            {s}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>

              {o.pendenciasCliente.length > 0 && (
                <div className="mt-4 rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Pendências do cliente
                  </p>
                  <ul className="mt-1.5 list-inside list-disc space-y-1 text-sm text-zinc-400">
                    {o.pendenciasCliente.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}

              {o.observacoes && (
                <p className="mt-3 text-xs text-zinc-500">{o.observacoes}</p>
              )}
            </Card>
          );
        })}
      </div>

      {onboardings && filtrados.length === 0 && (
        <EmptyState mensagem="Nenhum onboarding encontrado com os filtros atuais." />
      )}
    </div>
  );
}
