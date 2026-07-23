"use client";

// Memória Contextual (E4.1) + Sugestão (E4.2) — a superfície única da AIL num
// campo de decisão.
//
// Dois níveis, exatamente os do contrato PD-001:
//   N1 · INFORMAR — existe memória no slot: mostra o mais frequente, a
//        confidence e o caminho das evidências. Silencioso sem memória.
//   N2 · SUGERIR — Pattern ELEGÍVEL (consistente ∧ slot sem disputa — RFC-
//        AIL-005 §6.1) e o campo está VAZIO (Lei da Abstenção: só o vazio é
//        pré-preenchido; escolha humana jamais é sobrescrita): o Engine
//        registra a OFERTA (fato imutável — ADR-001) e pré-preenche o campo
//        com valor editável, removível e substituível.
//
// NUNCA bloqueia, NUNCA insiste (uma oferta por montagem; remover não
// re-oferece), NUNCA esconde origem/confidence/evidências.

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Brain, AlertTriangle, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useLiveQuery } from "@/lib/hooks";
import {
  localizarMemoria,
  propostaSegue,
} from "@/modules/adaptive-intelligence/application/pattern-matching";
import {
  gerarSugestao,
  type Sugestao,
} from "@/modules/adaptive-intelligence/application/suggestion-engine";
import {
  executarDelegacao,
  type ExecucaoDelegada,
} from "@/modules/adaptive-intelligence/application/delegation-runtime";

const TOM_CONFIDENCE = { observado: "gray", recorrente: "blue", consistente: "green" } as const;

interface MemoriaContextualProps {
  /** clienteId (tenant). Sem cliente selecionado, o componente não consulta. */
  empresa: string | null | undefined;
  contexto: string;
  campo: string;
  /** O valor atualmente no campo — comparado localmente (sem refetch por tecla). */
  proposta?: string;
  /** Entidade em edição (null/omitido em criação) — vai para o fato-da-oferta. */
  entidade?: { tipo: string; id: string } | null;
  /**
   * Habilita o nível SUGERIR: chamado com o valor oferecido (pré-preenchimento)
   * e com "" quando o operador remove a sugestão. Sem este callback, o
   * componente permanece só no nível INFORMAR.
   */
  onPreencher?: (valor: string) => void;
}

function dataCurta(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString("pt-BR");
}

export function MemoriaContextual({
  empresa,
  contexto,
  campo,
  proposta,
  entidade,
  onPreencher,
}: MemoriaContextualProps) {
  const consulta = useCallback(
    () => (empresa ? localizarMemoria({ empresa, contexto, campo }) : Promise.resolve(null)),
    [empresa, contexto, campo]
  );
  const { data: memoria } = useLiveQuery(consulta, [empresa, contexto, campo]);

  const [sugestao, setSugestao] = useState<Sugestao | null>(null);
  const [execucao, setExecucao] = useState<ExecucaoDelegada | null>(null);
  // Uma tentativa de oferta por (empresa, slot): nunca insistir, nunca re-oferecer.
  const ofertaTentada = useRef<string | null>(null);

  useEffect(() => {
    if (!empresa || !onPreencher) return;
    const chaveTentativa = `${empresa}|${contexto}|${campo}`;
    if (ofertaTentada.current === chaveTentativa) return;
    // Lei da Abstenção: só o VAZIO recebe preenchimento (delegado ou sugerido).
    if ((proposta ?? "").trim()) return;
    ofertaTentada.current = chaveTentativa;
    // E5.10b PRIMEIRO: delegação vigente (Knowledge institucional) precede a
    // sugestão (estatística). Ambas registram o fato antes da fala.
    void executarDelegacao({ empresa, contexto, campo, entidade: entidade ?? null }).then((e) => {
      if (e) {
        setExecucao(e);
        onPreencher(e.valor);
        return;
      }
      if (!memoria?.encontrada) return;
      void gerarSugestao({ empresa, contexto, campo, entidade: entidade ?? null }).then((s) => {
        if (s) {
          setSugestao(s);
          onPreencher(s.valor);
        }
      });
    });
    // proposta deliberadamente fora das deps: o preenchimento considera o
    // estado no momento do mount; digitação posterior não dispara novos atos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, contexto, campo, memoria, onPreencher, entidade]);

  // ── DELEGAÇÃO ATIVA (fato registrado; campo preenchido pelo runtime) ───────
  if (execucao && (proposta ?? "").trim() === execucao.valor) {
    return (
      <div className="rounded-lg border border-violet-500/30 bg-violet-500/[0.06] px-3 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-medium text-violet-300">
            <Sparkles size={13} /> Preenchido por delegação
          </span>
          <span className="font-mono text-zinc-100">{execucao.valor}</span>
          <Badge tone="violet">{`Knowledge v${execucao.knowledgeVersao}`}</Badge>
          <span className="text-zinc-400">delegado por {execucao.delegadoPor}</span>
          <Link
            href={`/ail/inteligencia/${execucao.knowledgePatternId}`}
            className="ml-auto font-medium text-sky-400 hover:text-sky-300"
          >
            Por quê? Ver a cadeia →
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-zinc-500">
          <span>executor {execucao.assinatura.autor} ({execucao.assinatura.versaoEngine})</span>
          <button
            type="button"
            onClick={() => {
              setExecucao(null);
              onPreencher?.("");
            }}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
          >
            <X size={11} /> Remover
          </button>
          <span className="text-zinc-600">— editável e substituível; a decisão continua sua.</span>
        </div>
      </div>
    );
  }

  if (!memoria?.encontrada || !memoria.maisFrequente) return null;
  const top = memoria.maisFrequente;

  // ── N2 · SUGESTÃO ATIVA (oferta registrada; campo pré-preenchido) ──────────
  if (sugestao && (proposta ?? "").trim() === sugestao.valor) {
    return (
      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.05] px-3 py-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 font-medium text-emerald-300">
            <Sparkles size={13} /> Sugerido pela memória organizacional
          </span>
          <span className="font-mono text-zinc-100">{sugestao.valor}</span>
          <Badge tone={TOM_CONFIDENCE[sugestao.confidence]}>{sugestao.confidence}</Badge>
          <span className="text-zinc-400">
            {sugestao.ocorrencias} decisões · última em {dataCurta(sugestao.ultimaOcorrencia)} · por{" "}
            {sugestao.ultimoAutor}
          </span>
          <Link
            href={`/ail/padroes/${sugestao.patternId}`}
            className="ml-auto font-medium text-sky-400 hover:text-sky-300"
          >
            Por quê? Ver evidências →
          </Link>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-zinc-500">
          <span>{sugestao.motivoElegibilidade}</span>
          <button
            type="button"
            onClick={() => {
              setSugestao(null);
              onPreencher?.("");
            }}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
          >
            <X size={11} /> Remover sugestão
          </button>
          <span className="text-zinc-600">— editável e substituível; a decisão é sua.</span>
        </div>
      </div>
    );
  }

  // ── N1 · INFORMAÇÃO (memória existe; sem oferta ativa) ─────────────────────
  const segue = propostaSegue(proposta, { campo: top.campo, valor: top.valor });
  return (
    <div className="rounded-lg border border-violet-500/20 bg-violet-500/[0.04] px-3 py-2.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-medium text-violet-300">
          <Brain size={13} /> Já fizemos isso antes
        </span>
        <span className="text-zinc-400">
          {top.ocorrencias === 1 ? "1 decisão registrada" : `${top.ocorrencias} decisões registradas`}
          {" — mais frequente:"}
        </span>
        <span className="font-mono text-zinc-100">{top.valor}</span>
        <Badge tone={TOM_CONFIDENCE[top.confidence]}>{top.confidence}</Badge>
        {memoria.emDisputa && <Badge tone="orange">em disputa</Badge>}
        <Link
          href={`/ail/padroes/${top.id}`}
          className="ml-auto font-medium text-sky-400 hover:text-sky-300"
        >
          Por quê? Ver evidências →
        </Link>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-zinc-500">
        <span>
          última em {dataCurta(top.ultimaOcorrencia)} · por {top.ultimoAutor}
        </span>
        {segue === true && <span className="text-emerald-400/90">· sua proposta segue a memória</span>}
        {segue === false && (
          <span className="flex items-center gap-1 text-amber-400/90">
            <AlertTriangle size={11} /> · difere do mais frequente (a decisão é sua)
          </span>
        )}
      </div>
    </div>
  );
}
