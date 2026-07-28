"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { useLiveQuery } from "@/lib/hooks";
import { formatBRL } from "@/lib/format";
import { listarAuditorias } from "@/lib/services/auditorias";
import { listarProdutos } from "@/lib/services/produtos";
import { listarTodasVariantes } from "@/lib/services/produtoVariantes";
import { criarExecucaoLote } from "@/lib/services/execucoesLote";
import { criarAnuncioGerado } from "@/lib/services/anunciosGerados";
import { rodarEsteira } from "@/lib/services/esteira";
import { ROTULO_PRIORIDADE } from "@/lib/auditoria";
import type { AnuncioGerado } from "@/lib/agentes/esteira";
import type { AuditoriaAnuncio, PrioridadeAuditoria, Produto, ProdutoVariante } from "@/lib/types";

const PESO: Record<PrioridadeAuditoria, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

const QUANTIDADES = ["3", "5", "10", "15"] as const;

type StatusItem = "pendente" | "rodando" | "ok" | "erro";

interface ItemLote {
  id: string;
  titulo: string;
  prioridade: PrioridadeAuditoria;
  status: StatusItem;
  anuncio?: AnuncioGerado;
  tipo?: "IA" | "Simulada";
  erro?: string;
}

/**
 * Monta o briefing da esteira a partir da auditoria, enriquecido com o
 * produto vinculado (custo, margem, ERP) e suas variações — quando existirem.
 */
function briefingDaAuditoria(
  a: AuditoriaAnuncio,
  produto?: Produto,
  variacoes: ProdutoVariante[] = []
): string {
  const blocoAuditoria = [
    `## Anúncio a otimizar (vindo da Auditoria em Massa)`,
    `- Título atual: ${a.tituloAtual}`,
    `- Categoria: ${a.categoria}`,
    `- Marketplace: ${a.marketplace}`,
    `- Preço: ${formatBRL(a.preco)} · Estoque: ${a.estoque} · Vendas: ${a.vendas} · Visitas: ${a.visitas}`,
    `- Classe ABC: ${a.classificacaoAbc} · Prioridade: ${a.prioridade} · Score atual: ${a.scoreQualidade}/100`,
    `- Problemas encontrados: ${a.problemasEncontrados}`,
    a.linkAnuncio ? `- Link: ${a.linkAnuncio}` : "",
  ];

  const blocoProduto = produto
    ? [
        ``,
        `## Produto vinculado (base do cliente)`,
        `- Nome: ${produto.nome}`,
        produto.marca || produto.modelo ? `- Marca/Modelo: ${produto.marca || "—"} / ${produto.modelo || "—"}` : "",
        `- SKU (pai): ${produto.sku}${produto.codErp ? ` · Cód. ERP: ${produto.codErp}` : ""}`,
        `- Custo: ${formatBRL(produto.custo)} · Preço: ${formatBRL(produto.precoVenda)}` +
          (produto.margem !== undefined ? ` · Margem Zion: ${produto.margem}%` : "") +
          (produto.precoMinimo !== undefined ? ` · Preço mínimo (piso 5%): ${formatBRL(produto.precoMinimo)}` : ""),
        produto.confiancaCusto ? `- Confiança do custo: ${produto.confiancaCusto}` : "",
      ]
    : [];

  const blocoVariacoes =
    variacoes.length > 0
      ? [
          ``,
          `## Variações (${variacoes.length})`,
          ...variacoes.slice(0, 15).map(
            (v) =>
              `- ${[v.cor, v.tamanho].filter(Boolean).join(" / ") || "—"} · SKU ${v.sku}${v.ean ? ` · EAN ${v.ean}` : ""} · estoque ${v.estoque}${v.precoBase > 0 ? ` · ${formatBRL(v.precoBase)}` : ""}`
          ),
          variacoes.length > 15 ? `- (+${variacoes.length - 15} variações na mesma grade)` : "",
        ]
      : [];

  return [...blocoAuditoria, ...blocoProduto, ...blocoVariacoes].filter(Boolean).join("\n");
}

const ICONE: Record<StatusItem, React.ReactNode> = {
  pendente: <Clock size={15} className="text-zinc-500" />,
  rodando: <Loader2 size={15} className="animate-spin text-violet-400" />,
  ok: <CheckCircle2 size={15} className="text-emerald-400" />,
  erro: <XCircle size={15} className="text-red-400" />,
};

export default function EsteiraLotePage() {
  const [cliente, setCliente] = useState("Todos");
  const [prioridade, setPrioridade] = useState("Todos");
  const [quantidade, setQuantidade] = useState("5");
  const [rodando, setRodando] = useState(false);
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [resumo, setResumo] = useState<string | null>(null);

  const { data: auditoriasData } = useLiveQuery(listarAuditorias);
  const auditorias = auditoriasData ?? [];
  const { data: produtosData } = useLiveQuery(listarProdutos);
  const { data: variantesData } = useLiveQuery(listarTodasVariantes);

  const produtoPorId = useMemo(() => {
    const m = new Map<string, Produto>();
    (produtosData ?? []).forEach((p) => m.set(p.id, p));
    return m;
  }, [produtosData]);

  const variantesPorProduto = useMemo(() => {
    const m = new Map<string, ProdutoVariante[]>();
    (variantesData ?? []).forEach((v) => {
      if (!v.produtoId) return;
      const arr = m.get(v.produtoId) ?? [];
      arr.push(v);
      m.set(v.produtoId, arr);
    });
    return m;
  }, [variantesData]);

  const clientes = useMemo(() => [...new Set(auditorias.map((a) => a.cliente))], [auditorias]);

  const fila = useMemo(() => {
    return auditorias
      .filter(
        (a) =>
          (cliente === "Todos" || a.cliente === cliente) &&
          (prioridade === "Todos" || ROTULO_PRIORIDADE[a.prioridade] === prioridade) &&
          a.statusAuditoria !== "otimizado" &&
          a.statusAuditoria !== "ignorado"
      )
      .sort((a, b) => PESO[a.prioridade] - PESO[b.prioridade] || a.scoreQualidade - b.scoreQualidade)
      .slice(0, Number(quantidade));
  }, [auditorias, cliente, prioridade, quantidade]);

  async function rodarLote() {
    if (fila.length === 0 || rodando) return;
    setRodando(true);
    setResumo(null);
    setItens(
      fila.map((a) => ({ id: a.id, titulo: a.tituloAtual, prioridade: a.prioridade, status: "pendente" as StatusItem }))
    );

    let aprovados = 0;
    let reprovados = 0;
    let erros = 0;
    let tipoFinal: "IA" | "Simulada" = "Simulada";

    for (let i = 0; i < fila.length; i++) {
      setItens((prev) => prev.map((it, idx) => (idx === i ? { ...it, status: "rodando" } : it)));
      try {
        const prod = fila[i].produtoId ? produtoPorId.get(fila[i].produtoId!) : undefined;
        const vars = fila[i].produtoId ? (variantesPorProduto.get(fila[i].produtoId!) ?? []) : [];
        const r = await rodarEsteira("", {
          contexto: briefingDaAuditoria(fila[i], prod, vars),
          produto: fila[i].tituloAtual,
          // A grade vai como DADO, não como texto no briefing: é dela que sai a
          // grade do anúncio. Sem isto o lote publicaria SKU inventado em massa.
          variantes: vars,
          precoVenda: prod?.precoVenda ?? 0,
        });
        tipoFinal = r.tipo;
        const aprovadoA10 = r.anuncio.vereditoA10 === "aprovado" && r.anuncio.pendencias.length === 0;
        if (aprovadoA10) aprovados++;
        else reprovados++;

        // Persiste na fila de aprovação (não perde o que a esteira produziu).
        // Falha na gravação não interrompe o lote.
        try {
          await criarAnuncioGerado({
            clienteId: fila[i].clienteId,
            cliente: fila[i].cliente,
            produtoId: fila[i].produtoId,
            produto: null,
            auditoriaId: fila[i].id,
            marketplace: fila[i].marketplace,
            origem: "esteira_lote",
            tipoExecucao: r.tipo,
            notaDiagnostico: r.anuncio.notaDiagnostico,
            vereditoA10: r.anuncio.vereditoA10,
            qtdPendencias: r.anuncio.pendencias.length,
            anuncio: r.anuncio,
            status: aprovadoA10 ? "aguardando_aprovacao" : "rascunho",
            aprovadoPor: "",
            aprovadoEm: null,
            criadoEm: new Date().toISOString(),
            observacoes: "",
          });
        } catch {
          /* persistência opcional: migração 004 pode não estar no Supabase ainda */
        }

        setItens((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "ok", anuncio: r.anuncio, tipo: r.tipo } : it))
        );
      } catch (falha) {
        erros++;
        setItens((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "erro", erro: falha instanceof Error ? falha.message : "erro" } : it
          )
        );
      }
    }

    // Registra a execução em lote (reaproveita a Execução em Lote da Auditoria em Massa)
    const base = fila[0];
    if (base) {
      await criarExecucaoLote({
        clienteId: base.clienteId,
        cliente: base.cliente,
        agenteId: "agt-22",
        agente: "Zion Auditoria em Massa",
        tipoExecucao: "auditoria_seo",
        quantidadeItens: fila.length,
        status: erros > 0 ? "erro" : "concluida",
        entradaResumo: `${fila.length} anúncios priorizados da auditoria`,
        saidaResumo: `${aprovados} aprovados (A10), ${reprovados} com pendências${erros ? `, ${erros} com erro` : ""} · esteira ${tipoFinal}`,
        erros: "",
        responsavel: "",
      });
    }

    setResumo(
      `${fila.length} processados · ${aprovados} aprovados na trava A10 · ${reprovados} com pendências${erros ? ` · ${erros} com erro` : ""}.`
    );
    setRodando(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/auditoria-massa" className="mb-2 inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft size={13} /> Auditoria em Massa
        </Link>
        <PageHeader
          title="Esteira em Lote"
          description="Roda a esteira nos anúncios priorizados da auditoria (críticos primeiro), em sequência. Cada item passa pela trava A10 individualmente."
        />
      </div>

      <Card title="1. Selecionar a fila">
        <div className="flex flex-wrap items-end gap-4">
          <FilterSelect label="Cliente" value={cliente} options={clientes} onChange={setCliente} />
          <FilterSelect label="Prioridade" value={prioridade} options={Object.values(ROTULO_PRIORIDADE)} onChange={setPrioridade} />
          <label className="flex items-center gap-2 text-xs text-zinc-500">
            Quantidade
            <select
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              className="rounded-lg border border-white/10 bg-[#12121c] px-2.5 py-1.5 text-xs text-zinc-200 outline-none hover:border-white/20 focus:border-violet-500/50"
            >
              {QUANTIDADES.map((q) => (
                <option key={q} value={q}>{q}</option>
              ))}
            </select>
          </label>
          <Button onClick={rodarLote} disabled={rodando || fila.length === 0}>
            {rodando ? (
              <><Sparkles size={14} className="animate-pulse" /> Rodando lote…</>
            ) : (
              <><Play size={14} /> Rodar esteira em lote ({fila.length})</>
            )}
          </Button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {fila.length} anúncios na fila com os filtros atuais. Cada um é uma execução da esteira — em modo simulado
          é instantâneo; com a API Claude configurada, roda em sequência para respeitar limites.
        </p>
      </Card>

      {resumo && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400">
          <CheckCircle2 size={15} /> {resumo}
        </p>
      )}

      {itens.length > 0 && (
        <Card title={`2. Resultado do lote (${itens.length})`}>
          <ul className="divide-y divide-white/[0.04]">
            {itens.map((it) => {
              const aprovadoA10 =
                it.anuncio && it.anuncio.vereditoA10 === "aprovado" && it.anuncio.pendencias.length === 0;
              return (
                <li key={it.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      {ICONE[it.status]}
                      <p className="max-w-96 truncate text-sm text-zinc-200">{it.titulo}</p>
                      <Badge tone={it.prioridade === "critica" ? "red" : it.prioridade === "alta" ? "orange" : "gray"}>
                        {ROTULO_PRIORIDADE[it.prioridade]}
                      </Badge>
                    </div>
                    {it.anuncio && (
                      <div className="flex items-center gap-2">
                        {it.tipo && <Badge>{it.tipo}</Badge>}
                        <Badge tone="gray">{`nota ${it.anuncio.notaDiagnostico}`}</Badge>
                        <Badge tone={aprovadoA10 ? "green" : "red"}>
                          {aprovadoA10 ? "A10: aprovado" : "A10: pendente"}
                        </Badge>
                      </div>
                    )}
                    {it.status === "erro" && (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <AlertTriangle size={13} /> {it.erro}
                      </span>
                    )}
                  </div>

                  {it.anuncio && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-violet-400 hover:text-violet-300">
                        Ver anúncio gerado
                      </summary>
                      <div className="mt-2 space-y-2 rounded-lg bg-black/20 p-3 text-xs text-zinc-300">
                        <p><span className="text-zinc-500">Título ({it.anuncio.tituloOtimizado.length}/60):</span> {it.anuncio.tituloOtimizado}</p>
                        <p><span className="text-zinc-500">Keywords:</span> {it.anuncio.palavrasChavePrincipais.join(", ")}</p>
                        <p className="whitespace-pre-wrap"><span className="text-zinc-500">Descrição curta:</span> {it.anuncio.descricaoCurta}</p>
                        {it.anuncio.pendencias.length > 0 && (
                          <div className="text-amber-400">
                            <p className="text-zinc-500">Pendências:</p>
                            <ul className="ml-4 list-disc">
                              {it.anuncio.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
