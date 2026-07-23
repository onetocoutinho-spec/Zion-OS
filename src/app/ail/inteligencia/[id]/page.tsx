"use client";

// Pattern no Decision Intelligence Center (E5.6) — a LINHA DO TEMPO LÓGICA:
//
//   Decision Journal → Pattern → Confidence → Offers → Observations →
//   Outcomes → Confidence Evolution → Promotion Readiness
//
// Cada etapa mostra sua explicação e aponta a projeção de origem. A tela nunca
// calcula: representa. Termos "promovido"/"confiável" não existem aqui.

import Link from "next/link";
import { useCallback } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveQuery } from "@/lib/hooks";
import { carregarPadraoNoCentro } from "@/modules/adaptive-intelligence/application/intelligence-center";

const TOM_CONFIDENCE = { observado: "gray", recorrente: "blue", consistente: "green" } as const;
const TOM_OUTCOME = { pending: "gray", confirmed: "green", modified: "orange" } as const;

function Etapa({ n, titulo, children }: { n: number; titulo: string; children: React.ReactNode }) {
  return (
    <Card className="mb-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-500/15 text-[11px] font-semibold text-violet-300">
          {n}
        </span>
        <h3 className="text-sm font-semibold text-zinc-200">{titulo}</h3>
      </div>
      <div className="text-sm text-zinc-300">{children}</div>
    </Card>
  );
}

export default function PadraoNoCentroPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const consulta = useCallback(() => carregarPadraoNoCentro(id), [id]);
  const { data: linha, carregando } = useLiveQuery(consulta, [id]);

  if (!carregando && !linha) {
    return (
      <div>
        <PageHeader title="Pattern não encontrado" description="O identificador não corresponde a nenhum padrão materializado." />
        <EmptyState mensagem="Nada aqui." acaoLabel="Voltar ao Center" acaoHref="/ail/inteligencia" />
      </div>
    );
  }
  if (!linha) return null;
  const { padrao, evolution, readiness, outcomes } = linha;

  return (
    <div>
      <Link href="/ail/inteligencia" className="mb-3 inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
        <ArrowLeft size={13} /> Decision Intelligence
      </Link>
      <PageHeader
        title={`${padrao.campo}: ${padrao.valor}`}
        description={`${padrao.contexto} · ${padrao.empresa} — a linha do tempo lógica: do fato registrado ao veredito de prontidão. Nada é calculado nesta tela.`}
      />

      <Etapa n={1} titulo="Decision Journal — os fatos">
        {padrao.ocorrencias} decisão(ões) de suporte registradas (append-only).{" "}
        <Link href={`/ail/padroes/${padrao.id}`} className="text-sky-400 hover:text-sky-300">
          Ver evidências com autor →
        </Link>
      </Etapa>

      <Etapa n={2} titulo="Pattern — a recorrência detectada">
        Chave canônica {padrao.contexto} · {padrao.campo} → <span className="font-mono text-xs">{padrao.valor}</span>{" "}
        (Detector determinístico, RFC-AIL-004). Primeira ocorrência{" "}
        {new Date(padrao.primeiraOcorrencia).toLocaleDateString("pt-BR")}, última{" "}
        {new Date(padrao.ultimaOcorrencia).toLocaleDateString("pt-BR")}.
      </Etapa>

      <Etapa n={3} titulo="Confidence — por contagem">
        <Badge tone={TOM_CONFIDENCE[padrao.confidence]}>{padrao.confidence}</Badge>{" "}
        {padrao.slotEstado === "em_disputa" && <Badge tone="orange">slot em disputa</Badge>}{" "}
        <span className="text-xs text-zinc-500">derivada dos limiares congelados — nunca atribuída.</span>
      </Etapa>

      <Etapa n={4} titulo="Offers — o sistema falou (e assinou)">
        {outcomes.length === 0
          ? "Nenhuma oferta emitida para este Pattern ainda — o conhecimento não foi devolvido ao campo."
          : `${outcomes.length} oferta(s) registrada(s) em append-only, com base congelada no instante.`}
      </Etapa>

      <Etapa n={5} titulo="Observations + Outcomes — o humano respondeu (E5.0/E5.1)">
        {outcomes.length === 0 ? (
          "Sem ofertas, sem observações — nada a projetar."
        ) : (
          <ul className="grid gap-2">
            {outcomes.map((o) => (
              <li key={o.outcomeId} className="rounded border border-white/5 bg-white/[0.02] p-2 text-xs">
                <Badge tone={TOM_OUTCOME[o.status]}>{o.status}</Badge>{" "}
                <span className="text-zinc-400">{o.explanation}</span>
              </li>
            ))}
          </ul>
        )}
      </Etapa>

      <Etapa n={6} titulo="Confidence Evolution — sobrevive sem o próprio eco? (E5.3)">
        <div className="mb-1">
          <Badge tone={TOM_CONFIDENCE[evolution.confidenceAnterior]}>{evolution.confidenceAnterior}</Badge>
          <span className="mx-2 text-zinc-500">→</span>
          <Badge tone={TOM_CONFIDENCE[evolution.confidenceProjetada]}>{evolution.confidenceProjetada}</Badge>
          <span className="ml-2 text-xs text-zinc-500">
            {evolution.suporte.independente}/{evolution.suporte.total} decisões independentes
            {evolution.evidenciasDescontadas.length > 0 &&
              ` · ${evolution.evidenciasDescontadas.length} consumida(s) por oferta`}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-zinc-400">{evolution.explanation}</p>
      </Etapa>

      <Etapa n={7} titulo="Promotion Readiness — pronto para uma futura promoção? (E5.4)">
        <div className="mb-2">
          {readiness.estruturalmenteElegivel ? (
            <Badge tone="green">estruturalmente elegível — aguarda a ADR-002</Badge>
          ) : (
            <Badge tone="orange">não elegível</Badge>
          )}
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {readiness.bloqueios.map((b) => (
            <Badge key={b} tone="gray">{b}</Badge>
          ))}
        </div>
        <p className="mb-2 text-xs leading-relaxed text-zinc-400">{readiness.explanation}</p>
        <div className="rounded border border-white/5 bg-white/[0.02] p-2 text-xs text-zinc-500">
          <div className="mb-1 font-medium text-zinc-400">Dependências da ADR-002 (nunca preenchidas com código):</div>
          <ul className="grid gap-0.5">
            {readiness.dependenciasAdr002.map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </div>
      </Etapa>
    </div>
  );
}
