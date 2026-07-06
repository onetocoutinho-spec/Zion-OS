"use client";

import { useMemo, useState } from "react";
import {
  LogOut,
  Package,
  Workflow,
  CheckCircle2,
  Send,
  Sparkles,
  Play,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Gauge,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/form";
import { useLiveQuery } from "@/lib/hooks";
import { getSupabase } from "@/lib/supabase/client";
import { montarContexto } from "@/lib/contexto";
import { listarProdutos } from "@/lib/services/produtos";
import { rodarEsteira } from "@/lib/services/esteira";
import {
  criarAnuncioGerado,
  listarAnunciosGeradosDoCliente,
  aprovarAnuncioGerado,
  rejeitarAnuncioGerado,
} from "@/lib/services/anunciosGerados";
import { portalResumo, quotaEsteira, type Perfil } from "@/lib/services/perfil";

const STATUS_ANUNCIO: Record<string, { texto: string; tone: "gray" | "blue" | "yellow" | "green" | "violet" | "orange" }> = {
  rascunho: { texto: "Em produção", tone: "blue" },
  aguardando_aprovacao: { texto: "Aguardando sua aprovação", tone: "yellow" },
  aprovado: { texto: "Aprovado", tone: "green" },
  publicado: { texto: "Publicado", tone: "violet" },
  rejeitado: { texto: "Rejeitado", tone: "orange" },
};

const SELECT =
  "w-full rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-2 text-sm text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500/50";

export function PortalApp({ perfil }: { perfil: Perfil }) {
  const { data: resumo } = useLiveQuery(portalResumo);
  const { data: quota } = useLiveQuery(quotaEsteira);
  const { data: produtos } = useLiveQuery(listarProdutos);
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(perfil.clienteId ?? ""),
    [perfil.clienteId]
  );

  const [produtoId, setProdutoId] = useState("");
  const [briefing, setBriefing] = useState("");
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const nome = resumo?.cliente || perfil.nome || "sua loja";
  const restante = quota?.restante ?? 0;
  const semCota = Boolean(quota) && restante <= 0;
  const produto = (produtos ?? []).find((p) => p.id === produtoId) ?? null;

  const anunciosOrdenados = useMemo(
    () => [...(anuncios ?? [])],
    [anuncios]
  );

  async function sair() {
    await getSupabase().auth.signOut();
  }

  async function rodar() {
    if (!produto || semCota || rodando) return;
    setRodando(true);
    setErro(null);
    try {
      const r = await rodarEsteira(briefing.trim(), {
        contexto: montarContexto({ produto }),
        produto: produto.nome,
      });
      const passouA10 =
        r.anuncio.vereditoA10 === "aprovado" && r.anuncio.pendencias.length === 0;
      await criarAnuncioGerado({
        clienteId: perfil.clienteId ?? "",
        cliente: nome,
        produtoId: produto.id,
        produto: produto.nome,
        auditoriaId: null,
        marketplace: produto.marketplace ?? "Mercado Livre",
        origem: "esteira",
        tipoExecucao: r.tipo,
        notaDiagnostico: r.anuncio.notaDiagnostico,
        vereditoA10: r.anuncio.vereditoA10,
        qtdPendencias: r.anuncio.pendencias.length,
        anuncio: r.anuncio,
        status: passouA10 ? "aguardando_aprovacao" : "rascunho",
        aprovadoPor: "",
        aprovadoEm: null,
        criadoEm: new Date().toISOString(),
        observacoes: "",
      });
      setBriefing("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o anúncio.");
    } finally {
      setRodando(false);
    }
  }

  async function aprovar(id: string) {
    setBusy(id);
    try {
      await aprovarAnuncioGerado(id, perfil.nome || "cliente");
    } finally {
      setBusy(null);
    }
  }
  async function rejeitar(id: string) {
    setBusy(id);
    try {
      await rejeitarAnuncioGerado(id, "Rejeitado pelo cliente.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#08080d] text-zinc-200">
      <header className="border-b border-white/5 bg-[#0b0b12]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{nome}</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-500">Portal · Zion Company</p>
            </div>
          </div>
          <button
            onClick={sair}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-white/20 hover:text-white"
          >
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">A sua operação</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Gere anúncios otimizados pela IA da Zion, revise e aprove — no seu ritmo.
          </p>
        </div>

        {/* Resumo + cota */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Produtos na base" value={resumo?.totalProdutos ?? 0} icon={Package} tone="blue" />
          <StatCard label="Em produção" value={resumo?.emProducao ?? 0} icon={Workflow} tone="violet" />
          <StatCard label="Aprovados" value={resumo?.aprovados ?? 0} icon={CheckCircle2} tone="green" />
          <StatCard label="Publicados" value={resumo?.publicados ?? 0} icon={Send} tone="cyan" />
        </div>

        {/* Gerar anúncio (esteira) */}
        <Card
          title="Criar anúncio com a IA"
          action={
            quota ? (
              <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                <Gauge size={13} />
                {quota.usado}/{quota.limite} anúncios este mês
              </span>
            ) : undefined
          }
        >
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex-1 min-w-56">
              <span className="mb-1 block text-[11px] font-medium text-zinc-500">Produto</span>
              <select className={SELECT} value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
                <option value="">Selecione um produto…</option>
                {(produtos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </label>
            <Button onClick={rodar} disabled={!produto || semCota || rodando}>
              {rodando ? (
                <><Sparkles size={14} className="animate-pulse" /> Gerando…</>
              ) : (
                <><Play size={14} /> Gerar anúncio</>
              )}
            </Button>
          </div>
          <div className="mt-3">
            <TextArea
              value={briefing}
              onChange={(e) => setBriefing(e.target.value)}
              rows={3}
              placeholder="Detalhes extras (opcional): material, público, diferenciais, links de concorrentes…"
            />
          </div>
          {semCota && (
            <p className="mt-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400 ring-1 ring-inset ring-amber-500/20">
              <AlertTriangle size={14} /> Você usou os {quota?.limite} anúncios do seu plano este mês. Fale com a Zion para ampliar.
            </p>
          )}
          {erro && (
            <p className="mt-3 flex items-center gap-2 text-xs text-red-400">
              <AlertTriangle size={14} /> {erro}
            </p>
          )}
        </Card>

        {/* Meus anúncios */}
        <Card title={`Meus anúncios (${anunciosOrdenados.length})`}>
          {anunciosOrdenados.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nenhum anúncio ainda. Escolha um produto acima e clique em “Gerar anúncio”.
            </p>
          ) : (
            <ul className="divide-y divide-white/[0.04]">
              {anunciosOrdenados.map((a) => {
                const s = STATUS_ANUNCIO[a.status] ?? { texto: a.status, tone: "gray" as const };
                const podeAprovar =
                  a.vereditoA10 === "aprovado" &&
                  a.qtdPendencias === 0 &&
                  (a.status === "aguardando_aprovacao" || a.status === "rascunho");
                const podeRejeitar = a.status !== "rejeitado" && a.status !== "publicado";
                return (
                  <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-zinc-200">
                          {a.anuncio?.tituloOtimizado || "(sem título)"}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {a.produto ? `${a.produto} · ` : ""}nota {a.notaDiagnostico}/100
                          {a.qtdPendencias > 0 ? ` · ${a.qtdPendencias} pendência(s)` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={s.tone}>{s.texto}</Badge>
                        {podeAprovar && (
                          <Button variant="success" className="px-2 py-1 text-xs" onClick={() => aprovar(a.id)} disabled={busy === a.id}>
                            <ShieldCheck size={13} /> Aprovar
                          </Button>
                        )}
                        {podeRejeitar && (
                          <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => rejeitar(a.id)} disabled={busy === a.id}>
                            <XCircle size={13} /> Rejeitar
                          </Button>
                        )}
                      </div>
                    </div>
                    <details className="mt-1.5">
                      <summary className="cursor-pointer text-[11px] text-violet-400 hover:text-violet-300">
                        ver anúncio
                      </summary>
                      <div className="mt-2 space-y-1 rounded-lg bg-black/20 p-3 text-xs text-zinc-400">
                        <p className="whitespace-pre-wrap"><span className="text-zinc-500">Descrição:</span> {a.anuncio?.descricaoCurta || "—"}</p>
                        {a.anuncio?.pendencias?.length > 0 && (
                          <div className="text-amber-400">
                            <p className="text-zinc-500">Pendências (resolva com a Zion antes de publicar):</p>
                            <ul className="ml-4 list-disc">
                              {a.anuncio.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <p className="pt-2 text-center text-xs text-zinc-600">
          Zion Company · plataforma de anúncios para marketplaces
        </p>
      </main>
    </div>
  );
}
