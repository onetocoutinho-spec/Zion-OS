"use client";

import { useMemo, useState } from "react";
import {
  Workflow,
  Play,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Button";
import { TextArea } from "@/components/ui/form";
import { useLiveQuery } from "@/lib/hooks";
import { useLojaAtual } from "@/lib/contexto/LojaAtualProvider";
import { listarProdutos } from "@/lib/services/produtos";
import { listarVariantesDoProduto } from "@/lib/services/produtoVariantes";
import { listarImagensDoProduto } from "@/lib/services/imagensProduto";
import { montarContexto, resumoDoContexto } from "@/lib/contexto";
import { rodarEsteira } from "@/lib/services/esteira";
import { rodarCadeiaEsteira, type PassoCadeia } from "@/lib/services/cadeiaEsteira";
import {
  criarAnuncioGerado,
  aprovarAnuncioGerado,
} from "@/lib/services/anunciosGerados";
import type { AnuncioGerado } from "@/lib/agentes/esteira";

const STATUS_PASSO: Record<PassoCadeia["status"], { rotulo: string; classe: string }> = {
  pendente: { rotulo: "•", classe: "text-zinc-600 bg-white/[0.03]" },
  rodando: { rotulo: "…", classe: "text-violet-300 bg-violet-500/15 ring-1 ring-inset ring-violet-500/30 animate-pulse" },
  ok: { rotulo: "✓", classe: "text-emerald-400 bg-emerald-500/10" },
  erro: { rotulo: "!", classe: "text-red-400 bg-red-500/10" },
  pulado: { rotulo: "–", classe: "text-zinc-600 bg-white/[0.02]" },
};

const SELECT =
  "w-full rounded-lg border border-white/10 bg-surface-input px-2.5 py-1.5 text-xs text-zinc-200 outline-none transition-colors hover:border-white/20 focus:border-violet-500";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{titulo}</p>
      <div className="mt-1.5 text-sm text-zinc-300">{children}</div>
    </div>
  );
}

export default function EsteiraPage() {
  // A loja vem do contexto global (cookie + ?loja=); o select abaixo só o escreve.
  const { lojaId, loja: cliente, lojas: clientes, definirLoja } = useLojaAtual();
  const clienteId = lojaId ?? "";
  const [produtoId, setProdutoId] = useState("");
  const [briefing, setBriefing] = useState("");
  const [modo, setModo] = useState<"rapido" | "aprofundado">("rapido");
  const [passos, setPassos] = useState<PassoCadeia[]>([]);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"IA" | "Simulada" | null>(null);
  const [anuncio, setAnuncio] = useState<AnuncioGerado | null>(null);
  const [aprovado, setAprovado] = useState(false);
  const [aprovando, setAprovando] = useState(false);
  const [erroAprovacao, setErroAprovacao] = useState<string | null>(null);
  /** Id do registro persistido (fila de aprovação); null = não salvo (sem cliente). */
  const [registroId, setRegistroId] = useState<string | null>(null);

  const { data: produtos } = useLiveQuery(listarProdutos);

  const produtosFiltrados = (produtos ?? []).filter((p) => !clienteId || p.clienteId === clienteId);
  const produto = produtosFiltrados.find((p) => p.id === produtoId) ?? null;

  const contexto = useMemo(
    () => montarContexto({ cliente, produto }),
    [cliente, produto]
  );
  const resumo = resumoDoContexto({ cliente, produto });
  const podeRodar = Boolean(briefing.trim() || contexto);

  const bloqueiaAprovacao =
    !anuncio || anuncio.vereditoA10 === "reprovado" || anuncio.pendencias.length > 0;

  function selecionarCliente(id: string) {
    definirLoja(id || null);
    setProdutoId("");
  }
  function selecionarProduto(id: string) {
    setProdutoId(id);
    const p = (produtos ?? []).find((x) => x.id === id);
    if (p && !clienteId) definirLoja(p.clienteId);
  }

  async function rodar() {
    if (!podeRodar || rodando) return;
    setRodando(true);
    setErro(null);
    setAviso(null);
    setAnuncio(null);
    setTipo(null);
    setAprovado(false);
    setRegistroId(null);
    setPassos([]);
    try {
      // A grade cadastrada vai como DADO nos dois modos. Sem produto escolhido
      // ela fica vazia — e vazia vira pendência, nunca grade inventada.
      const variantes = produto ? await listarVariantesDoProduto(produto.id) : [];
      // A CONTAGEM DE FOTOS SEGUE A MESMA REGRA DA GRADE, logo acima.
      //
      // Sem produto escolhido esta tela roda só com um briefing digitado — não
      // há produto, então não há foto, e 0 é o número certo. A pendência que
      // aparece também está certa: aquele texto não publica como está, porque o
      // Mercado Livre exige uma imagem e não há produto a que anexá-la.
      const fotos = produto ? await listarImagensDoProduto(produto.id) : [];
      const r =
        modo === "aprofundado"
          ? await rodarCadeiaEsteira({
              briefing: briefing.trim() || undefined,
              contexto: contexto || undefined,
              produto: produto?.nome,
              variantes,
              precoVenda: produto?.precoVenda ?? 0,
              fotosDoProduto: fotos.length,
              onPasso: setPassos,
            })
          : await rodarEsteira(briefing.trim(), {
              contexto: contexto || undefined,
              produto: produto?.nome,
              variantes,
              precoVenda: produto?.precoVenda ?? 0,
              fotosDoProduto: fotos.length,
            });
      setAnuncio(r.anuncio);
      setTipo(r.tipo);
      setAviso(r.aviso ?? null);

      // Persiste o anúncio gerado (fila de aprovação). Precisa de um cliente.
      // Falha na gravação (ex.: migração 004 não rodada) NÃO derruba o anúncio.
      if (cliente) {
        try {
          const passouA10 =
            r.anuncio.vereditoA10 === "aprovado" && r.anuncio.pendencias.length === 0;
          const reg = await criarAnuncioGerado({
            clienteId: cliente.id,
            cliente: cliente.empresa,
            produtoId: produto?.id ?? null,
            produto: produto?.nome ?? null,
            auditoriaId: null,
            marketplace: produto?.marketplace ?? "Mercado Livre",
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
            observacoes:
              modo === "aprofundado" ? "Gerado no modo aprofundado (multi-agente)." : "",
          });
          setRegistroId(reg.id);
        } catch {
          setAviso(
            "Anúncio gerado, mas não foi salvo na fila (rode a migração 004 no Supabase para persistir as aprovações)."
          );
        }
      }
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Falha ao rodar a esteira.");
    } finally {
      setRodando(false);
    }
  }

  async function aprovar() {
    if (bloqueiaAprovacao || aprovado || aprovando) return;
    // Antes não havia try/catch: se o Supabase recusasse, a promessa morria sem
    // dono, `setAprovado(true)` nunca rodava e o botão simplesmente não mudava —
    // a pessoa clicava de novo, achando que não tinha pegado.
    setAprovando(true);
    setErroAprovacao(null);
    try {
      if (registroId) await aprovarAnuncioGerado(registroId);
      setAprovado(true);
    } catch (e) {
      setErroAprovacao(e instanceof Error ? e.message : "Não consegui aprovar agora.");
    } finally {
      setAprovando(false);
    }
  }

  // "Aplicar no anuncio" saiu em 07/08. Ele escrevia o titulo em `anuncios` — a
  // tabela da era agencia, ZERO linhas desde que esta esteira nasceu. O seletor
  // que o alimentava estava sempre vazio em producao, entao o botao nunca podia
  // aparecer. O anuncio que a esteira produz ja e gravado em `anuncios_gerados`,
  // e e de la que a publicacao no ML sai.

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Esteira de Anúncio"
          description="Deixe os dados do produto e rode a esteira (diagnóstico → SEO → construção → revisão) numa passada. Sai o anúncio pronto, com a trava de aprovação antes de publicar."
        />
        <LinkButton href="/esteira/lote" variant="ghost">
          <Workflow size={14} /> Rodar em lote
        </LinkButton>
      </div>

      {/* Entrada */}
      <Card title="1. Produto e briefing">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">Loja</span>
            <select className={SELECT} value={clienteId} onChange={(e) => selecionarCliente(e.target.value)}>
              <option value="">Todas as lojas</option>
              {(clientes ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.empresa}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-medium text-zinc-500">Produto</span>
            <select className={SELECT} value={produtoId} onChange={(e) => selecionarProduto(e.target.value)}>
              <option value="">Nenhum</option>
              {produtosFiltrados.map((p) => (
                <option key={p.id} value={p.id}>{clienteId ? p.nome : `${p.nome} (${p.cliente})`}</option>
              ))}
            </select>
          </label>
        </div>

        {contexto && (
          <details className="mt-3">
            <summary className="inline-flex items-center text-xs text-violet-400 hover:text-violet-300 [@media(pointer:coarse)]:min-h-11">
              Contexto: {resumo} — ver dados que a esteira vai usar
            </summary>
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-zinc-400">
              {contexto}
            </pre>
          </details>
        )}

        <div className="mt-4">
          <TextArea
            value={briefing}
            onChange={(e) => setBriefing(e.target.value)}
            rows={4}
            placeholder={
              contexto
                ? "Briefing adicional (opcional) — links de concorrentes, palavras-chave, observações. Se vazio, a esteira roda com os dados do produto."
                : "Cole o briefing do produto (nome, marca, categoria, custo, preço, grade, material…)."
            }
          />
          {/* Modo de execução */}
          <div className="mt-3 inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5 text-xs">
            {(["rapido", "aprofundado"] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={modo === m}
                onClick={() => setModo(m)}
                disabled={rodando}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors [@media(pointer:coarse)]:min-h-11 ${
                  modo === m ? "bg-violet-500/15 text-violet-300" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m === "rapido" ? "Rápido (uma passada)" : "Aprofundado (multi-agente)"}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-3">
            <Button onClick={rodar} disabled={rodando || !podeRodar}>
              {rodando ? (
                <><Sparkles size={14} className="animate-pulse" /> Rodando a esteira…</>
              ) : (
                <><Play size={14} /> Rodar esteira</>
              )}
            </Button>
            <span className="text-[11px] text-zinc-600">
              {modo === "aprofundado"
                ? "Roda A0→A1→A2→A9→construtores→A4→A10, um agente por vez (mais lento, máxima fidelidade)."
                : "Roda A1→A2→A9→A4→A10 numa passada só (rápido). Usa a IA configurada no servidor."}
            </span>
          </div>

          {/* Progresso da cadeia (modo aprofundado) */}
          {passos.length > 0 && (
            <div className="mt-4 rounded-lg border border-white/5 bg-black/20 p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Linha de produção
              </p>
              <div className="flex flex-wrap gap-1.5">
                {passos.map((p) => {
                  const s = STATUS_PASSO[p.status];
                  return (
                    <span
                      key={p.codigo}
                      title={`${p.codigo} · ${p.nome} — ${p.status}`}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${s.classe}`}
                    >
                      <span className="tabular-nums">{s.rotulo}</span> {p.codigo}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* role="alert": a falha é anunciada, não só pintada. */}
      {erro && (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" /> {erro}
        </p>
      )}
      {aviso && (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {aviso}
        </p>
      )}

      {anuncio && (
        <>
          {/* Veredito + trava */}
          <Card title="2. Revisão final (A10) e aprovação">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className={`text-3xl font-semibold ${anuncio.notaDiagnostico >= 75 ? "text-emerald-400" : anuncio.notaDiagnostico >= 55 ? "text-amber-400" : "text-red-400"}`}>
                    {anuncio.notaDiagnostico}
                  </p>
                  <p className="text-[11px] text-zinc-500">diagnóstico /100</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Badge tone={anuncio.vereditoA10 === "aprovado" ? "green" : "red"}>
                    {anuncio.vereditoA10 === "aprovado" ? "A10: Aprovado" : "A10: Reprovado"}
                  </Badge>
                  {tipo && <Badge>{tipo}</Badge>}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Button
                  variant={aprovado ? "success" : "primary"}
                  onClick={aprovar}
                  disabled={bloqueiaAprovacao || aprovado || aprovando}
                >
                  {aprovado ? (
                    <><CheckCircle2 size={14} /> Aprovado — pronto p/ publicar</>
                  ) : aprovando ? (
                    <><Loader2 size={14} className="animate-spin" /> Aprovando…</>
                  ) : (
                    <><ShieldCheck size={14} /> Aprovar para publicação</>
                  )}
                </Button>
                {erroAprovacao && (
                  <span role="alert" className="text-[11px] text-red-400">
                    {erroAprovacao} — tente de novo.
                  </span>
                )}
                {bloqueiaAprovacao && !aprovado && (
                  <span className="text-[11px] text-amber-400">
                    Trava: resolva as pendências e o veredito A10 antes de aprovar.
                  </span>
                )}
                {aprovado && (
                  <span className="text-[11px] text-emerald-400">
                    Aprovado e salvo na fila — o envio via API entra na Fase 2.
                  </span>
                )}
                {registroId ? (
                  <LinkButton href="/esteira/aprovacoes" variant="ghost" className="px-2 py-1 text-xs">
                    Salvo na fila de aprovação — abrir
                  </LinkButton>
                ) : (
                  <span className="text-[11px] text-zinc-500">
                    Selecione um cliente antes de rodar para salvar na fila.
                  </span>
                )}
              </div>
            </div>
            <p className="mt-3 border-t border-white/5 pt-3 text-sm text-zinc-400">{anuncio.motivoVeredito}</p>
          </Card>

          {/* Pendências */}
          {anuncio.pendencias.length > 0 && (
            <Card title={`Pendências (${anuncio.pendencias.length})`}>
              <ul className="space-y-1.5">
                {anuncio.pendencias.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-amber-400">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Anúncio pronto */}
          <Card title="3. Anúncio gerado">
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-white/[0.03] p-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-zinc-500">Título otimizado ({anuncio.tituloOtimizado.length}/60)</p>
                  <p className="text-sm font-medium text-zinc-100">{anuncio.tituloOtimizado}</p>
                </div>
              </div>

              <Secao titulo="Palavras-chave">
                <p><span className="text-zinc-500">Principais:</span> {anuncio.palavrasChavePrincipais.join(", ") || "—"}</p>
                <p><span className="text-zinc-500">Secundárias:</span> {anuncio.palavrasChaveSecundarias.join(", ") || "—"}</p>
              </Secao>

              <Secao titulo="Descrição">
                <p className="whitespace-pre-wrap">{anuncio.descricaoCompleta}</p>
                {anuncio.descricaoCurta && (
                  <p className="mt-2 text-xs text-zinc-500">Curta: {anuncio.descricaoCurta}</p>
                )}
              </Secao>

              {anuncio.fichaTecnica.length > 0 && (
                <Secao titulo="Ficha técnica / Atributos">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <tbody className="divide-y divide-white/[0.04]">
                        {anuncio.fichaTecnica.map((a, i) => (
                          <tr key={i}>
                            {/* sem " *": ver D5 do DES-001 */}
                            <td className="py-1.5 pr-4 text-zinc-500">{a.atributo}</td>
                            <td className="py-1.5 text-zinc-300">{a.valor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-600">* atributo obrigatório da categoria</p>
                </Secao>
              )}

              {anuncio.tabelaMedidas && (
                <Secao titulo="Tabela de medidas">
                  <pre className="whitespace-pre-wrap rounded-lg bg-black/20 p-3 font-mono text-[11px] text-zinc-400">{anuncio.tabelaMedidas}</pre>
                  {anuncio.comoMedir && <p className="mt-2 text-xs text-zinc-500">Como medir: {anuncio.comoMedir}</p>}
                  {anuncio.forma !== "nao_aplicavel" && <p className="text-xs text-zinc-500">Forma: calça {anuncio.forma}</p>}
                </Secao>
              )}

              {anuncio.variacoes.length > 0 && (
                <Secao titulo={`Variações (${anuncio.variacoes.length})`}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-[10px] uppercase tracking-wider text-zinc-600">
                          <th className="py-1 pr-3">Cor</th><th className="py-1 pr-3">Tam.</th><th className="py-1 pr-3">SKU</th>
                          <th className="py-1 pr-3">EAN</th><th className="py-1 pr-3">Est.</th><th className="py-1 pr-3">Preço</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.04]">
                        {anuncio.variacoes.map((v, i) => (
                          <tr key={i} className="text-zinc-300">
                            <td className="py-1.5 pr-3">{v.cor}</td><td className="py-1.5 pr-3">{v.tamanho}</td>
                            <td className="py-1.5 pr-3">{v.sku}</td><td className="py-1.5 pr-3">{v.ean}</td>
                            <td className="py-1.5 pr-3">{v.estoque}</td><td className="py-1.5 pr-3">{v.preco}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Secao>
              )}

              {anuncio.imagensSugeridas.length > 0 && (
                <Secao titulo="Prompts de imagem">
                  <ul className="space-y-1.5">
                    {anuncio.imagensSugeridas.map((im, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium text-zinc-400">{im.tipo}:</span>{" "}
                        <span className="text-zinc-500">{im.prompt}</span>
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}

              {anuncio.faq.length > 0 && (
                <Secao titulo="FAQ">
                  <ul className="space-y-2">
                    {anuncio.faq.map((f, i) => (
                      <li key={i} className="text-xs">
                        <p className="text-zinc-300">{f.pergunta}</p>
                        <p className="text-zinc-500">{f.resposta}</p>
                      </li>
                    ))}
                  </ul>
                </Secao>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
