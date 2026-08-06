"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ClipboardCheck,
  AlertOctagon,
  Flame,
  Play,
  Wand2,
  Search,
  Image as ImageIcon,
  DollarSign,
} from "lucide-react";
import { resumoDaAuditoria } from "@/modules/portal/domain/resumoDoPulso";
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

/**
 * As colunas, numa constante porque DUAS renderizações as usam: a tabela
 * carregada e o esqueleto que aparece antes dela. Esqueleto com número de
 * colunas diferente do conteúdo é o pulo de layout que ele evita.
 */
const COLUNAS_DA_LISTA = [
  "Produto / anúncio",
  "Prioridade",
  "Nota",
  "Principal problema",
  "Próxima ação",
];

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

  const pulso = useMemo(() => resumoDaAuditoria(m), [m]);

  const temProdutos = (produtos ?? []).length > 0;

  return (
    <>
      <PageHeader
        titulo="Auditoria da loja"
        /* SEM AUDITORIA, O SUBTÍTULO VOLTA A CONVIDAR — visto na tela.
         *
         * Com a lista vazia, `pulso.frase` é "Nenhuma auditoria ainda" e o
         * cartão logo abaixo diz exatamente a mesma coisa, com o botão. A
         * frase do cabeçalho só informa quando HÁ o que informar; repetida,
         * ela vira ruído no lugar mais nobre da tela.
         *
         * A regra geral do item B é "o subtítulo diz o que a tela descobriu" —
         * e quando não há descoberta, dizer o que ela FAZ volta a ser o certo. */
        subtitulo={
          lista.length === 0
            ? "Descubra o que corrigir primeiro para vender mais. A IA analisa sua base e prioriza."
            : `${pulso.frase}${pulso.detalhe ? ` ${pulso.detalhe}` : ""}`
        }
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

      {/* CARREGANDO antes de vazio. `lista` é `auditorias ?? []`, e o `?? []`
          fazia esta tela afirmar "nenhuma auditoria ainda" — e sugerir rodar
          uma — enquanto a busca ainda estava no ar. */}
      {estado === "carregando" ? (
        <Table carregando headers={COLUNAS_DA_LISTA}>{null}</Table>
      ) : lista.length === 0 ? (
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
          {/* SETE CARTÕES VIRARAM QUATRO, E OS ZEROS SOMEM. (PLANO-004, item B.)
           *
           * Saíram "Total auditados" — que agora está na frase do cabeçalho,
           * onde informa em vez de ocupar — e "Score médio", que é palavra do
           * sistema: a lojista não decide nada com "62 de 100".
           *
           * Os três de CATEGORIA (foto, preço, texto) ficam, porque é neles
           * que está a ação — mas só quando têm o que mostrar. Um cartão
           * "Problemas de imagem: 0" pesa igual a "Problemas de imagem: 22" e
           * obriga a leitura que a frase do cabeçalho já fez. */}
          <div className="flex flex-wrap gap-3">
            {[
              { label: "Críticos", n: m.criticos, icon: AlertOctagon, tone: "red" as const },
              { label: "Prioridade alta", n: m.altas, icon: Flame, tone: "orange" as const },
              { label: "Problemas de imagem", n: m.imagem, icon: ImageIcon, tone: "blue" as const },
              { label: "Problemas de preço", n: m.preco, icon: DollarSign, tone: "green" as const },
              { label: "Problemas de texto", n: m.seo, icon: Search, tone: "cyan" as const },
            ]
              .filter((c) => c.n > 0)
              .map((c) => (
                <div key={c.label} className="min-w-40 flex-1">
                  <StatCard label={c.label} value={c.n} icon={c.icon} tone={c.tone} />
                </div>
              ))}
            <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-[#0e0e16] p-4">
              <Link href="/cliente/anunciar">
                <Button variant="ghost">
                  <Wand2 size={15} /> Gerar otimização
                </Button>
              </Link>
            </div>
          </div>

          <Table headers={COLUNAS_DA_LISTA}>
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
