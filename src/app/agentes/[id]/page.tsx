"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Bot, History, Link2, Pencil, Play } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/form";
import { IMPLANTACAO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import {
  alterarStatusImplantacao,
  buscarAgente,
  listarExecucoesDoAgente,
  registrarExecucao,
} from "@/lib/services/agentes";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-300">{children}</p>
    </div>
  );
}

function formatDataHora(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AgenteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [executando, setExecutando] = useState(false);

  const { data: agente, carregando } = useLiveQuery(() => buscarAgente(id), [id]);
  const { data: execucoes } = useLiveQuery(() => listarExecucoesDoAgente(id), [id]);

  if (carregando) return null;
  if (!agente)
    return <EmptyState mensagem="Agente não encontrado." acaoLabel="Voltar para agentes" acaoHref="/agentes" />;

  async function executar() {
    if (!agente) return;
    setExecutando(true);
    await registrarExecucao(agente);
    setTimeout(() => setExecutando(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
            <Bot size={24} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-white">{agente.nome}</h1>
              <Badge>{agente.statusImplantacao}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-zinc-500">
              {agente.area} · uso {agente.frequenciaUso.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Implantação
            <Select
              options={IMPLANTACAO_STATUS}
              value={agente.statusImplantacao}
              onChange={(e) =>
                alterarStatusImplantacao(id, e.target.value as typeof agente.statusImplantacao)
              }
              className="!w-auto py-1.5"
            />
          </label>
          <LinkButton href={`/agentes/${id}/editar`} variant="ghost">
            <Pencil size={14} /> Editar
          </LinkButton>
          <Button onClick={executar} disabled={executando}>
            <Play size={14} />
            {executando ? "Executando…" : "Executar agente"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="Definição do agente">
          <div className="space-y-4">
            <Info label="Objetivo">{agente.objetivo}</Info>
            <Info label="Quando usar">{agente.quandoUsar}</Info>
            <Info label="Entrada necessária">{agente.entradaNecessaria}</Info>
            <Info label="Saída esperada">{agente.saidaEsperada}</Info>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Prompt resumido</p>
              <p className="mt-1 rounded-lg bg-white/[0.03] p-3 font-mono text-xs leading-relaxed text-zinc-400">
                {agente.promptResumido}
              </p>
            </div>
            {agente.agentesConectados.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Agentes conectados</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {agente.agentesConectados.map((a) => (
                    <span key={a} className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] px-2.5 py-1 text-xs text-zinc-400">
                      <Link2 size={11} /> {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card title={`Histórico de execuções (${execucoes?.length ?? 0})`}>
          {execucoes && execucoes.length > 0 ? (
            <ul className="space-y-3">
              {execucoes.map((e) => (
                <li key={e.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                      <History size={12} /> {formatDataHora(e.dataHora)}
                    </span>
                    <Badge tone="violet">Simulada</Badge>
                  </div>
                  <p className="mt-2 text-sm text-zinc-300">{e.contexto}</p>
                  <p className="mt-1 text-xs text-zinc-500">{e.resultado}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Este agente ainda não foi executado." />
          )}
          <p className="mt-4 text-[11px] text-zinc-600">
            As execuções são simuladas nesta versão. A integração real com a API Claude está no roadmap da v1.2+.
          </p>
        </Card>
      </div>
    </div>
  );
}
