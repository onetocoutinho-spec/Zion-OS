"use client";

import { useMemo, useState } from "react";
import {
  LogOut,
  Sparkles,
  Play,
  ShieldCheck,
  XCircle,
  AlertTriangle,
  Gauge,
  Upload,
  Download,
  ClipboardList,
  CheckCircle2,
  Circle,
  Wand2,
  ArrowRight,
  PartyPopper,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useLiveQuery } from "@/lib/hooks";
import { getSupabase } from "@/lib/supabase/client";
import { montarContexto } from "@/lib/contexto";
import { listarProdutos } from "@/lib/services/produtos";
import {
  analisarProdutosCsv,
  confirmarImportacaoProdutos,
  gerarTemplateProdutosCsv,
  type AnaliseProdutos,
} from "@/lib/services/importacaoProdutos";
import { gerarAuditoriasDaBase } from "@/lib/services/auditoriaDaBase";
import { rodarEsteira } from "@/lib/services/esteira";
import {
  criarAnuncioGerado,
  listarAnunciosGeradosDoCliente,
  aprovarAnuncioGerado,
  rejeitarAnuncioGerado,
} from "@/lib/services/anunciosGerados";
import { portalResumo, quotaEsteira, type Perfil } from "@/lib/services/perfil";
import type { AnuncioGeradoRegistro, Produto } from "@/lib/types";

type Estado = "pendente" | "gerando" | "revisar" | "otimizado";

export function PortalApp({ perfil }: { perfil: Perfil }) {
  const { data: resumo } = useLiveQuery(portalResumo);
  const { data: quota } = useLiveQuery(quotaEsteira);
  const { data: produtos } = useLiveQuery(listarProdutos);
  const { data: anuncios } = useLiveQuery(
    () => listarAnunciosGeradosDoCliente(perfil.clienteId ?? ""),
    [perfil.clienteId]
  );

  const [rodandoId, setRodandoId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [analise, setAnalise] = useState<AnaliseProdutos | null>(null);
  const [importando, setImportando] = useState(false);
  const [auditando, setAuditando] = useState(false);
  const [msgBase, setMsgBase] = useState<string | null>(null);

  const nome = resumo?.cliente || perfil.nome || "sua loja";
  const restante = quota?.restante ?? 0;
  const semCota = Boolean(quota) && restante <= 0;
  const listaProdutos = produtos ?? [];

  // Último anúncio de cada produto (para saber o estado de cada um).
  const anuncioPorProduto = useMemo(() => {
    const m = new Map<string, AnuncioGeradoRegistro>();
    [...(anuncios ?? [])]
      .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1))
      .forEach((a) => {
        if (a.produtoId && !m.has(a.produtoId)) m.set(a.produtoId, a);
      });
    return m;
  }, [anuncios]);

  function estadoDoProduto(p: Produto): { estado: Estado; anuncio?: AnuncioGeradoRegistro } {
    if (rodandoId === p.id) return { estado: "gerando" };
    const a = anuncioPorProduto.get(p.id);
    if (!a) return { estado: "pendente" };
    if (a.status === "aprovado" || a.status === "publicado") return { estado: "otimizado", anuncio: a };
    return { estado: "revisar", anuncio: a };
  }

  const itens = useMemo(() => {
    const ordem: Record<Estado, number> = { revisar: 0, gerando: 1, pendente: 2, otimizado: 3 };
    return listaProdutos
      .map((p) => ({ produto: p, ...estadoDoProduto(p) }))
      .sort((a, b) => ordem[a.estado] - ordem[b.estado] || a.produto.nome.localeCompare(b.produto.nome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listaProdutos, anuncioPorProduto, rodandoId]);

  const total = listaProdutos.length;
  const otimizados = itens.filter((i) => i.estado === "otimizado").length;
  const aRevisar = itens.filter((i) => i.estado === "revisar").length;
  const pct = total > 0 ? Math.round((otimizados / total) * 100) : 0;

  async function sair() {
    await getSupabase().auth.signOut();
  }

  async function otimizar(produto: Produto) {
    if (semCota || rodandoId) return;
    setRodandoId(produto.id);
    setErro(null);
    try {
      const r = await rodarEsteira("", {
        contexto: montarContexto({ produto }),
        produto: produto.nome,
      });
      const passouA10 = r.anuncio.vereditoA10 === "aprovado" && r.anuncio.pendencias.length === 0;
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o anúncio.");
    } finally {
      setRodandoId(null);
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

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setMsgBase(null);
    setAnalise(analisarProdutosCsv(await file.text()));
  }
  function baixarModelo() {
    const blob = new Blob([String.fromCharCode(0xfeff) + gerarTemplateProdutosCsv()], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importar() {
    if (!analise || analise.total === 0 || importando) return;
    setImportando(true);
    setMsgBase(null);
    try {
      const r = await confirmarImportacaoProdutos({ clienteId: perfil.clienteId ?? "", cliente: nome, linhas: analise.linhas });
      setMsgBase(`${r.total} produtos importados${r.totalVariacoes > 0 ? ` e ${r.totalVariacoes} variações` : ""}.`);
      setAnalise(null);
    } catch (e) {
      setMsgBase(e instanceof Error ? `Falha ao importar: ${e.message}` : "Falha ao importar.");
    } finally {
      setImportando(false);
    }
  }
  async function auditar() {
    if (!perfil.clienteId || auditando) return;
    setAuditando(true);
    setMsgBase(null);
    try {
      const r = await gerarAuditoriasDaBase(perfil.clienteId, nome);
      setMsgBase(r.auditados === 0 ? "Base já auditada." : `Base auditada: ${r.auditados} produtos analisados.`);
    } catch (e) {
      setMsgBase(e instanceof Error ? `Falha ao auditar: ${e.message}` : "Falha ao auditar.");
    } finally {
      setAuditando(false);
    }
  }

  // Qual é o "próximo passo" a comunicar no topo?
  const proximoPasso =
    total === 0
      ? "Comece importando a sua base de produtos."
      : aRevisar > 0
        ? `Você tem ${aRevisar} anúncio(s) prontos para revisar e aprovar.`
        : otimizados < total
          ? "Otimize os produtos abaixo, um a um, até todos ficarem prontos."
          : "Tudo otimizado! 🎉";

  return (
    <div className="min-h-screen bg-[#08080d] text-zinc-200">
      <header className="border-b border-white/5 bg-[#0b0b12]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{nome}</p>
              <p className="text-[11px] uppercase tracking-widest text-zinc-500">Portal · Zion Company</p>
            </div>
          </div>
          <button onClick={sair} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:border-white/20 hover:text-white">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        {/* Progresso + próximo passo */}
        <div className="rounded-xl border border-white/5 bg-[#0e0e16] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-white">Otimização da sua loja</h1>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-violet-300">
                <ArrowRight size={14} /> {proximoPasso}
              </p>
            </div>
            {quota && (
              <span className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
                <Gauge size={13} /> {quota.usado}/{quota.limite} anúncios este mês
              </span>
            )}
          </div>
          {total > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-500">
                <span><span className="font-semibold text-zinc-200">{otimizados}</span> de {total} produtos otimizados</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
        </div>

        {erro && (
          <p className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            <AlertTriangle size={15} /> {erro}
          </p>
        )}

        {/* Passo 1 — base vazia: importar em destaque */}
        {total === 0 ? (
          <Card title="Passo 1 · Importe a sua base de produtos">
            <p className="mb-3 text-sm text-zinc-400">
              Suba a planilha com os seus produtos (nome, custo, preço…). Não tem o modelo? Baixe abaixo.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input type="file" accept=".csv,text/csv" onChange={aoEscolherArquivo}
                className="text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-violet-500" />
              <Button variant="ghost" onClick={baixarModelo}><Download size={14} /> Baixar modelo</Button>
            </div>
            {analise && !analise.erro && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3 text-sm">
                <span className="text-zinc-300"><span className="font-semibold text-white">{analise.total}</span> produtos{analise.modo === "agrupado" ? ` · ${analise.totalVariacoes} variações` : ""}</span>
                <Button onClick={importar} disabled={importando}><Upload size={14} /> {importando ? "Importando…" : "Importar"}</Button>
              </div>
            )}
            {msgBase && <p className="mt-3 flex items-center gap-2 text-sm text-emerald-400"><CheckCircle2 size={15} /> {msgBase}</p>}
          </Card>
        ) : (
          <>
            {/* Barra de ferramentas da base (quando já tem produtos) */}
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/5 bg-white/[0.02] px-4 py-2.5 text-sm">
              <span className="text-zinc-400">Base:</span>
              <label className="text-xs text-zinc-400">
                <input type="file" accept=".csv,text/csv" onChange={aoEscolherArquivo}
                  className="text-xs text-zinc-300 file:mr-2 file:rounded-md file:border-0 file:bg-white/10 file:px-2 file:py-1 file:text-xs file:text-zinc-200 hover:file:bg-white/20" />
              </label>
              {analise && !analise.erro && (
                <Button className="px-2 py-1 text-xs" onClick={importar} disabled={importando}>
                  <Upload size={13} /> {importando ? "…" : `Importar +${analise.total}`}
                </Button>
              )}
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={auditar} disabled={auditando}>
                <ClipboardList size={13} /> {auditando ? "Auditando…" : "Auditar base"}
              </Button>
              {msgBase && <span className="text-xs text-emerald-400">{msgBase}</span>}
            </div>

            {/* Fila de otimização — cada produto do início ao fim */}
            <Card title={`Seus produtos (${total})`}>
              {otimizados === total && total > 0 && (
                <p className="mb-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                  <PartyPopper size={15} /> Todos os produtos estão otimizados!
                </p>
              )}
              <ul className="divide-y divide-white/[0.04]">
                {itens.map(({ produto, estado, anuncio }) => (
                  <li key={produto.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-2.5">
                        {estado === "otimizado" ? (
                          <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-emerald-400" />
                        ) : estado === "gerando" ? (
                          <Sparkles size={17} className="mt-0.5 shrink-0 animate-pulse text-violet-400" />
                        ) : estado === "revisar" ? (
                          <Wand2 size={17} className="mt-0.5 shrink-0 text-amber-400" />
                        ) : (
                          <Circle size={17} className="mt-0.5 shrink-0 text-zinc-600" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-200">{produto.nome}</p>
                          {estado === "revisar" && anuncio && (
                            <p className="mt-0.5 text-xs text-zinc-400">
                              Novo título: <span className="text-zinc-300">{anuncio.anuncio?.tituloOtimizado}</span> · nota {anuncio.notaDiagnostico}/100
                              {anuncio.qtdPendencias > 0 ? ` · ${anuncio.qtdPendencias} pendência(s)` : ""}
                            </p>
                          )}
                          {estado === "otimizado" && anuncio && (
                            <p className="mt-0.5 text-xs text-zinc-500">{anuncio.status === "publicado" ? "Publicado no marketplace" : "Aprovado — pronto para publicar"}</p>
                          )}
                          {estado === "pendente" && (
                            <p className="mt-0.5 text-xs text-zinc-500">Ainda não otimizado</p>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {estado === "pendente" && (
                          <Button className="px-2.5 py-1 text-xs" onClick={() => otimizar(produto)} disabled={semCota || rodandoId !== null}>
                            <Play size={13} /> Otimizar
                          </Button>
                        )}
                        {estado === "gerando" && (
                          <Badge tone="violet">Gerando…</Badge>
                        )}
                        {estado === "revisar" && anuncio && (
                          <>
                            {anuncio.vereditoA10 === "aprovado" && anuncio.qtdPendencias === 0 ? (
                              <Button variant="success" className="px-2 py-1 text-xs" onClick={() => aprovar(anuncio.id)} disabled={busy === anuncio.id}>
                                <ShieldCheck size={13} /> Aprovar
                              </Button>
                            ) : (
                              <Badge tone="yellow">Revisar pendências</Badge>
                            )}
                            <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => rejeitar(anuncio.id)} disabled={busy === anuncio.id}>
                              <XCircle size={13} /> Refazer
                            </Button>
                          </>
                        )}
                        {estado === "otimizado" && <Badge tone="green">Otimizado</Badge>}
                      </div>
                    </div>

                    {estado === "revisar" && anuncio && (anuncio.anuncio?.pendencias?.length ?? 0) > 0 && (
                      <details className="mt-1.5 pl-7">
                        <summary className="cursor-pointer text-[11px] text-violet-400 hover:text-violet-300">ver pendências</summary>
                        <ul className="ml-4 mt-1 list-disc text-xs text-amber-400">
                          {anuncio.anuncio!.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                        </ul>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </>
        )}

        {semCota && (
          <p className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-400 ring-1 ring-inset ring-amber-500/20">
            <AlertTriangle size={14} /> Você usou os {quota?.limite} anúncios do seu plano este mês. Fale com a Zion para ampliar.
          </p>
        )}

        <p className="pt-2 text-center text-xs text-zinc-600">Zion Company · plataforma de anúncios para marketplaces</p>
      </main>
    </div>
  );
}
