"use client";

// Detalhe de um Pattern (E4.0) — a cadeia de explicabilidade completa:
// identidade → confidence (com o PORQUÊ derivado dos limiares congelados) →
// evidências (as Decisions de suporte, com autor e proposta) → concorrentes.
// SOMENTE LEITURA — nada aqui aprende, decide ou recomputa.

import Link from "next/link";
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { useLiveQuery } from "@/lib/hooks";
import { carregarDetalhePadrao } from "@/modules/adaptive-intelligence/application/pattern-browser";

const TOM_CONFIDENCE = { observado: "gray", recorrente: "blue", consistente: "green" } as const;

function dataHora(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleString("pt-BR");
}

export default function DetalhePadraoPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const consulta = useCallback(() => carregarDetalhePadrao(id), [id]);
  const { data: p, carregando } = useLiveQuery(consulta, [id]);

  if (!carregando && !p) {
    return (
      <div>
        <PageHeader title="Padrão não encontrado" description="O identificador não corresponde a nenhum padrão materializado." />
        <EmptyState mensagem="Nada aqui." acaoLabel="Voltar à memória" acaoHref="/ail/padroes" />
      </div>
    );
  }
  if (!p) return null;

  return (
    <div>
      <Link
        href="/ail/padroes"
        className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200"
      >
        <ArrowLeft size={13} /> Memória Organizacional
      </Link>
      <PageHeader
        title={`${p.campo}: ${p.valor}`}
        description={`${p.contexto} · ${p.empresa} — tudo nesta página é derivado das decisões listadas abaixo; nada é inferido.`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="O que a organização sabe">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Assunto (slot)</dt>
            <dd className="text-zinc-200">{p.contexto} · {p.campo}</dd>
            <dt className="text-zinc-500">Valor aprendido</dt>
            <dd className="font-mono text-zinc-100">{p.valor}</dd>
            <dt className="text-zinc-500">Decisões de suporte</dt>
            <dd className="text-zinc-200">{p.ocorrencias}</dd>
            <dt className="text-zinc-500">Primeira ocorrência</dt>
            <dd className="text-zinc-200">{dataHora(p.primeiraOcorrencia)}</dd>
            <dt className="text-zinc-500">Última ocorrência</dt>
            <dd className="text-zinc-200">{dataHora(p.ultimaOcorrencia)}</dd>
            <dt className="text-zinc-500">Último autor</dt>
            <dd className="text-zinc-200">{p.ultimoAutor}</dd>
            <dt className="text-zinc-500">Quem já decidiu</dt>
            <dd className="text-zinc-200">{p.autores.join(", ")}</dd>
            <dt className="text-zinc-500">PatternId</dt>
            <dd className="truncate font-mono text-xs text-zinc-500" title={p.id}>{p.id.slice(0, 16)}…</dd>
          </dl>
        </Card>

        <Card title="Confiança — e por quê">
          <div className="mb-2 flex items-center gap-2">
            <Badge tone={TOM_CONFIDENCE[p.confidence]}>{p.confidence}</Badge>
            <Badge tone="gray">{p.estado}</Badge>
            {p.slotEstado === "em_disputa" && <Badge tone="orange">slot em disputa</Badge>}
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">{p.explicacaoConfidence}</p>
          <p className="mt-3 text-xs text-zinc-500">
            Derivado dos limiares congelados da arquitetura (RFC-AIL-004) — a confiança nunca é
            atribuída; é contada.
          </p>
        </Card>
      </div>

      <div className="mt-4">
        <Card title={`Evidências — as ${p.evidencias.length} decisões que formaram este padrão`}>
          <Table headers={["Quando", "Autor", "De → Para", "Entidade", "Origem"]}>
            {p.evidencias.length === 0 && (
              <EmptyRow mensagem="As decisões de suporte não estão acessíveis nesta sessão." colSpan={5} />
            )}
            {p.evidencias.map((e) => (
              <tr key={e.id} className="border-t border-white/5">
                <Td>{dataHora(e.quando)}</Td>
                <Td>{e.autor}</Td>
                <TdMain>
                  <span className="font-mono text-xs">
                    {e.valorAnterior ?? "—"} → {e.valorNovo}
                  </span>
                </TdMain>
                <Td>{e.entidade.tipo} · {e.entidade.id}</Td>
                <Td>{e.origem}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>

      {p.concorrentes.length > 0 && (
        <div className="mt-4">
          <Card title="Valores concorrentes no mesmo assunto (divergência)">
            <ul>
              {p.concorrentes.map((c) => (
                <li key={c.id} className="flex items-center gap-3 border-t border-white/5 py-2 first:border-t-0">
                  <span className="font-mono text-sm text-zinc-100">{c.valor}</span>
                  <Badge tone={TOM_CONFIDENCE[c.confidence]}>{c.confidence}</Badge>
                  <span className="text-xs text-zinc-400">{c.ocorrencias} {c.ocorrencias === 1 ? "decisão" : "decisões"}</span>
                  <Link href={`/ail/padroes/${c.id}`} className="ml-auto text-xs text-sky-400 hover:text-sky-300">
                    Ver evidências →
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
