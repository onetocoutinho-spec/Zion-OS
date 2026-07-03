"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { onboardings } from "@/lib/data/onboardings";

const STATUS = ["Não iniciado", "Em andamento", "Concluído", "Travado"];

function CheckItem({ label, done }: { label: string; done: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={`flex h-4.5 w-4.5 items-center justify-center rounded-full ${
          done ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-500/15 text-zinc-500"
        }`}
      >
        {done ? <Check size={11} /> : <X size={11} />}
      </span>
      <span className={done ? "text-zinc-300" : "text-zinc-500"}>{label}</span>
    </li>
  );
}

export default function OnboardingPage() {
  const [status, setStatus] = useState("Todos");

  const filtrados = onboardings.filter(
    (o) => status === "Todos" || o.statusGeral === status
  );

  return (
    <div>
      <PageHeader
        title="Onboarding"
        description="Checklist de entrada de cada cliente novo na operação."
        count={filtrados.length}
        countLabel="onboardings"
      />

      <div className="mb-4 flex flex-wrap gap-4">
        <FilterSelect label="Status geral" value={status} options={STATUS} onChange={setStatus} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {filtrados.map((o) => (
          <Card
            key={o.id}
            title={o.cliente}
            action={<Badge>{o.statusGeral}</Badge>}
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <ul className="space-y-2">
                <CheckItem label="Contrato fechado" done={o.contratoFechado} />
                <CheckItem label="Base de produtos recebida" done={o.baseProdutosRecebida} />
                <CheckItem label="Pastas criadas" done={o.pastasCriadas} />
                <li className="flex items-center justify-between gap-2 text-sm text-zinc-400">
                  Diagnóstico inicial <Badge>{o.diagnosticoInicial}</Badge>
                </li>
                <li className="flex items-center justify-between gap-2 text-sm text-zinc-400">
                  Reunião inicial <Badge>{o.reuniaoInicial}</Badge>
                </li>
                <li className="flex items-center justify-between gap-2 text-sm text-zinc-400">
                  Plano de 30 dias <Badge>{o.planoTrintaDias}</Badge>
                </li>
              </ul>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Acessos recebidos
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {o.acessosRecebidos.length === 0 && (
                      <span className="text-xs text-zinc-600">Nenhum</span>
                    )}
                    {o.acessosRecebidos.map((a) => (
                      <Badge key={a} tone="green">{a}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Acessos pendentes
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {o.acessosPendentes.length === 0 && (
                      <span className="text-xs text-zinc-600">Nenhum</span>
                    )}
                    {o.acessosPendentes.map((a) => (
                      <Badge key={a} tone="yellow">{a}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {o.pendenciasCliente.length > 0 && (
              <div className="mt-5 rounded-lg border border-amber-500/15 bg-amber-500/5 p-3">
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
          </Card>
        ))}
      </div>

      {filtrados.length === 0 && (
        <p className="py-10 text-center text-sm text-zinc-500">
          Nenhum onboarding encontrado com os filtros atuais.
        </p>
      )}
    </div>
  );
}
