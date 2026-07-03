"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, Bot, History, Link2, Pencil, Play, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select, TextArea } from "@/components/ui/form";
import { IMPLANTACAO_STATUS } from "@/lib/constantes";
import { useLiveQuery } from "@/lib/hooks";
import {
  alterarStatusImplantacao,
  buscarAgente,
  executarAgenteIA,
  listarExecucoesDoAgente,
} from "@/lib/services/agentes";
import { formatDateTime } from "@/lib/format";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-sm text-zinc-300">{children}</p>
    </div>
  );
}

export default function AgenteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const [entrada, setEntrada] = useState("");
  const [executando, setExecutando] = useState(false);
  const [resultado, setResultado] = useState<string | null>(null);
  const [tipoResultado, setTipoResultado] = useState<"IA" | "Simulada" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const { data: agente, carregando } = useLiveQuery(() => buscarAgente(id), [id]);
  const { data: execucoes } = useLiveQuery(() => listarExecucoesDoAgente(id), [id]);

  if (carregando) return null;
  if (!agente)
    return <EmptyState mensagem="Agente não encontrado." acaoLabel="Voltar para agentes" acaoHref="/agentes" />;

  async function executar(e: React.FormEvent) {
    e.preventDefault();
    if (!agente || !entrada.trim() || executando) return;
    setExecutando(true);
    setErro(null);
    setAviso(null);
    setResultado(null);
    setTipoResultado(null);
    try {
      const retorno = await executarAgenteIA(agente, entrada.trim());
      setResultado(retorno.resultado);
      setTipoResultado(retorno.tipo);
      setAviso(retorno.aviso ?? null);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao executar o agente.");
    } finally {
      setExecutando(false);
    }
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
        </div>
      </div>

      {/* Painel de execução via API Claude */}
      <Card title="Executar agente">
        <form onSubmit={executar}>
          <TextArea
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            rows={4}
            placeholder={`Entrada para o agente — ${agente.entradaNecessaria}`}
          />
          <div className="mt-3 flex items-center gap-3">
            <Button type="submit" disabled={executando || !entrada.trim()}>
              {executando ? (
                <>
                  <Sparkles size={14} className="animate-pulse" /> Executando com IA…
                </>
              ) : (
                <>
                  <Play size={14} /> Executar agente
                </>
              )}
            </Button>
            <span className="text-[11px] text-zinc-600">
              Usa a API Claude quando a ANTHROPIC_API_KEY está configurada no servidor.
            </span>
          </div>
        </form>

        {erro && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erro}
          </p>
        )}

        {aviso && (
          <p className="mt-4 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {aviso}
          </p>
        )}

        {resultado && (
          <div className="mt-4 rounded-lg border border-violet-500/20 bg-violet-500/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-300">
                Resultado
              </p>
              {tipoResultado && <Badge>{tipoResultado}</Badge>}
            </div>
            <div className="max-h-96 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {resultado}
            </div>
          </div>
        )}
      </Card>

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
            <ul className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {execucoes.map((e) => (
                <li key={e.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                      <History size={12} /> {formatDateTime(e.dataHora)}
                    </span>
                    <Badge>{e.tipo}</Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-300">{e.contexto}</p>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs text-zinc-500">
                    {e.resultado}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compacto mensagem="Este agente ainda não foi executado." />
          )}
        </Card>
      </div>
    </div>
  );
}
