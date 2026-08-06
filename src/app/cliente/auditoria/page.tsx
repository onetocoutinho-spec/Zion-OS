"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  AlertOctagon,
  Flame,
  Gauge,
  Play,
  Wand2,
  Search,
  Image as ImageIcon,
  DollarSign,
} from "lucide-react";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { PageHeader, Pill, VazioAmigavel } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarAuditorias } from "@/lib/services/auditorias";
import { gerarAuditoriasDaBase } from "@/lib/services/auditoriaDaBase";
import { listarProdutos } from "@/lib/services/produtos";
import { toneScore } from "@/lib/client-portal/metrics";
import type { PrioridadeAuditoria } from "@/lib/types";

const TONE_PRIO: Record<PrioridadeAuditoria, "red" | "orange" | "yellow" | "gray"> = {
  critica: "red",
  alta: "orange",
  media: "yellow",
  baixa: "gray",
};
const ROTULO_PRIO: Record<PrioridadeAuditoria, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export default function ClienteAuditoria() {
  const { clienteId, nome } = useClientPortal();
  const { data: auditorias, estado } = useLiveQuery(listarAuditorias);
  const { data: produtos } = useLiveQuery(listarProdutos);

  const [auditando, setAuditando] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const lista = auditorias ?? [];

  const m = useMemo(() => {
    const criticos = lista.filter((a) => a.prioridade === "critica").length;
    const altas = lista.filter((a) => a.prioridade === "alta").length;
    const score = lista.length
      ? Math.round(lista.reduce((s, a) => s + a.scoreQualidade, 0) / lista.length)
      : null;
    const buscarProblema = (chave: string) =>
      lista.filter((a) => (a.problemasEncontrados || "").toLowerCase().includes(chave)).length;
    return {
      total: lista.length,
      criticos,
      altas,
      score,
      seo: buscarProblema("seo") + buscarProblema("título") + buscarProblema("titulo"),
      imagem: buscarProblema("imagem") + buscarProblema("foto"),
      preco: buscarProblema("preço") + buscarProblema("preco") + buscarProblema("margem"),
    };
  }, [lista]);

  const ordenadas = useMemo(() => {
    const ordem: Record<PrioridadeAuditoria, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };
    return [...lista].sort(
      (a, b) => ordem[a.prioridade] - ordem[b.prioridade] || a.scoreQualidade - b.scoreQualidade
    );
  }, [lista]);

  async function auditar() {
    if (!clienteId || auditando) return;
    setAuditando(true);
    setMsg(null);
    try {
      const r = await gerarAuditoriasDaBase(clienteId, nome);
      setMsg(
        r.auditados === 0
          ? "Sua base já está auditada. Rode novamente após importar novos produtos."
          : `Auditoria concluída: ${r.auditados} produtos analisados.`
      );
    } catch (e) {
      setMsg(e instanceof Error ? `Falha ao auditar: ${e.message}` : "Falha ao auditar.");
    } finally {
      setAuditando(false);
    }
  }

  const temProdutos = (produtos ?? []).length > 0;

  return (
    <>
      <PageHeader
        titulo="Auditoria da loja"
        subtitulo="Descubra o que corrigir primeiro para vender mais. A IA analisa sua base e prioriza."
        acao={
          temProdutos ? (
            <Button onClick={auditar} disabled={auditando}>
              <Play size={15} /> {auditando ? "Auditando…" : "Auditar base"}
            </Button>
          ) : undefined
        }
      />

      {msg && (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          {msg}
        </p>
      )}

      {lista.length === 0 ? (
        <VazioAmigavel
          icon={ClipboardCheck}
          titulo="Nenhuma auditoria ainda"
          descricao={
            temProdutos
              ? "Clique em “Auditar base” para a IA analisar seus produtos e apontar o que melhorar."
              : "Importe seus produtos primeiro. Depois a auditoria mostra o que priorizar."
          }
          acao={
            temProdutos ? (
              <Button onClick={auditar} disabled={auditando}>
                <Play size={15} /> {auditando ? "Auditando…" : "Auditar base"}
              </Button>
            ) : (
              <Link href="/cliente/produtos">
                <Button>Importar produtos</Button>
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Total auditados" value={m.total} icon={ClipboardCheck} tone="violet" />
            <StatCard label="Críticos" value={m.criticos} icon={AlertOctagon} tone={m.criticos ? "red" : "gray"} />
            <StatCard label="Prioridade alta" value={m.altas} icon={Flame} tone={m.altas ? "orange" : "gray"} />
            <StatCard
              label="Score médio"
              value={m.score != null ? m.score : "—"}
              hint="de 100"
              icon={Gauge}
              tone={m.score != null && m.score >= 70 ? "green" : "yellow"}
            />
            <StatCard label="Problemas de SEO" value={m.seo} icon={Search} tone="cyan" />
            <StatCard label="Problemas de imagem" value={m.imagem} icon={ImageIcon} tone="blue" />
            <StatCard label="Problemas de preço" value={m.preco} icon={DollarSign} tone="green" />
            <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0e0e16] p-4">
              <Link href="/cliente/anunciar">
                <Button variant="ghost">
                  <Wand2 size={15} /> Gerar otimização
                </Button>
              </Link>
            </div>
          </div>

          <Table
            carregando={estado === "carregando"}
            headers={["Produto / anúncio", "Prioridade", "Score", "Principal problema", "Próxima ação"]}
          >
            {ordenadas.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              ordenadas.map((a) => (
                <tr key={a.id} className="hover:bg-white/[0.02]">
                  <TdMain sub={a.marketplace}>{a.tituloAtual || "Produto"}</TdMain>
                  <Td>
                    <Pill tone={TONE_PRIO[a.prioridade]}>{ROTULO_PRIO[a.prioridade]}</Pill>
                  </Td>
                  <Td>
                    <Pill tone={toneScore(a.scoreQualidade)}>{a.scoreQualidade}/100</Pill>
                  </Td>
                  <Td className="max-w-64">
                    <span className="line-clamp-2 text-zinc-400">{a.problemasEncontrados || "—"}</span>
                  </Td>
                  <Td className="max-w-56">
                    <span className="line-clamp-2 text-zinc-400">{a.proximaAcao || "—"}</span>
                  </Td>
                </tr>
              ))
            )}
          </Table>
        </>
      )}
    </>
  );
}
