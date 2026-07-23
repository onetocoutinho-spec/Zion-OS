"use client";

// Decision Intelligence Center (E5.6) — a primeira interface operacional.
//
// A tela é uma REPRESENTAÇÃO VISUAL das projeções: consome o Analytics (E5.5)
// e a composição por Pattern (E5.1/3/4) prontos — nunca cria métrica, nunca
// recalcula, nunca mantém estado próprio. Atualizar os fatos atualiza a
// projeção, que atualiza a interface.

import Link from "next/link";
import { Activity, AlertTriangle, Brain } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, Td, TdMain, EmptyRow } from "@/components/ui/Table";
import { useLiveQuery } from "@/lib/hooks";
import { carregarVisaoDoCentro } from "@/modules/adaptive-intelligence/application/intelligence-center";
import { ReprojecaoPadroes } from "@/components/ail/ReprojecaoPadroes";

const TOM_CONFIDENCE = { observado: "gray", recorrente: "blue", consistente: "green" } as const;

function Metrica({ rotulo, valor, hint }: { rotulo: string; valor: number; hint?: string }) {
  return (
    <div title={hint} className="rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2">
      <div className="text-lg font-semibold text-zinc-100">{valor}</div>
      <div className="text-[11px] text-zinc-500">{rotulo}</div>
    </div>
  );
}

export default function InteligenciaPage() {
  const { data: visao, carregando } = useLiveQuery(carregarVisaoDoCentro);

  if (!carregando && (!visao || visao.padroes.length === 0)) {
    return (
      <div>
        <PageHeader
          title="Decision Intelligence"
          description="O estado da inteligência da plataforma — tudo proveniente de projeções determinísticas; nada é calculado nesta tela."
        />
        <EmptyState mensagem="Nenhum Pattern materializado ainda. O Center acorda junto com a memória — cada seção abaixo passa a existir quando os fatos existirem." />
        {/* E5.7: a primeira projeção também nasce daqui — sem script. */}
        <div className="mt-4">
          <ReprojecaoPadroes />
        </div>
      </div>
    );
  }
  if (!visao) return null;
  const a = visao.analytics;

  return (
    <div>
      <PageHeader
        title="Decision Intelligence"
        description="O estado da inteligência da plataforma — tudo proveniente de projeções determinísticas; nada é calculado nesta tela. Cada métrica declara a própria metodologia (passe o mouse)."
        count={a.patterns.total}
        countLabel="padrões"
      />

      {/* ── Reprojeção oficial (E5.7): gatilho humano, relatório de auditoria ── */}
      <div className="mb-4">
        <ReprojecaoPadroes />
      </div>

      {/* ── Platform Health: fatos, nunca nota (E5.5) ── */}
      <Card title="Platform Health — fatos, nunca nota" className="mb-4">
        <ul className="grid gap-1 text-sm text-zinc-300">
          {a.health.fatos.map((f) => (
            <li key={f}>· {f}</li>
          ))}
        </ul>
        {a.health.principaisBloqueios.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-zinc-500">Principais bloqueios:</span>
            {a.health.principaisBloqueios.map((b) => (
              <Badge key={b.motivo} tone="orange">{`${b.motivo} (${b.quantidade})`}</Badge>
            ))}
          </div>
        )}
      </Card>

      {/* ── Seções do Analytics (E5.5, intocado) ── */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Metrica rotulo="Patterns consistentes" valor={a.patterns.consistentes} hint={a.metodologia.patterns} />
        <Metrica rotulo="Sobrevivem ao desconto" valor={a.patterns.sobreviventesAposEvolution} hint={a.metodologia.confidence} />
        <Metrica rotulo="Ofertas emitidas" valor={a.offers.emitidas} hint={a.metodologia.offers} />
        <Metrica rotulo="Outcomes respondidos" valor={a.offers.respondidas} hint={a.metodologia.outcomes} />
        <Metrica rotulo="Prontos p/ promoção" valor={a.promotionReadiness.estruturalmenteElegiveis} hint={a.metodologia.promotionReadiness} />
      </div>

      {/* ── Patterns: a lista completa, tudo das projeções ── */}
      <Card
        title="Patterns — atual → projetada (E5.3) · prontidão (E5.4) · outcomes (E5.1)"
        action={
          <Link href="/ail/padroes" className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300">
            <Brain size={13} /> Memória (evidências)
          </Link>
        }
      >
        <Table headers={["Assunto", "Valor", "Confiança", "Após E5.3", "Prontidão", "Outcomes", ""]}>
          {visao.padroes.length === 0 && <EmptyRow mensagem="Sem padrões." colSpan={7} />}
          {visao.padroes.map(({ padrao, evolution, readiness, outcomes }) => (
            <tr key={padrao.id} className="border-t border-white/5">
              <Td>
                {padrao.contexto} · {padrao.campo}
                {readiness.disputas && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[11px] text-amber-400">
                    <AlertTriangle size={11} /> disputa
                  </span>
                )}
              </Td>
              <TdMain>
                <span className="font-mono text-xs">{padrao.valor}</span>
              </TdMain>
              <Td><Badge tone={TOM_CONFIDENCE[padrao.confidence]}>{padrao.confidence}</Badge></Td>
              <Td>
                {evolution.confidenceProjetada === padrao.confidence ? (
                  <span className="text-xs text-emerald-400/90">sobrevive</span>
                ) : (
                  <span className="text-xs text-amber-400/90">
                    → {evolution.confidenceProjetada} (eco descontado)
                  </span>
                )}
              </Td>
              <Td>
                {readiness.estruturalmenteElegivel ? (
                  <Badge tone="green">elegível (aguarda ADR-002)</Badge>
                ) : (
                  <span className="text-xs text-zinc-500">{readiness.bloqueios.length} bloqueio(s)</span>
                )}
              </Td>
              <Td>{outcomes.length}</Td>
              <Td>
                <Link
                  href={`/ail/inteligencia/${padrao.id}`}
                  className="flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300"
                >
                  <Activity size={12} /> Linha do tempo →
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
