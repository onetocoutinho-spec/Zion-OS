"use client";

// A faixa que traduz 1.060 infrações em uma frase acionável.
//
// ===========================================================================
// POR QUE UMA FAIXA E NÃO UMA TELA NOVA
// ===========================================================================
//
// O dado não é novo — é o mesmo `infracoes_marketplace` que já existe desde a
// migração 052, e os anúncios já estão listados logo abaixo. Uma tela separada
// obrigaria a lojista a comparar duas listas para saber QUAL anúncio está
// pausado, que é exatamente o trabalho que ela não deveria fazer.
//
// ===========================================================================
// O NÚMERO QUE MUDA A CONVERSA
// ===========================================================================
//
// "400 anúncios com problema" manda a lojista abrir 400 abas. "Quase tudo é
// foto" manda ela chamar um fotógrafo. A causa dominante é a única linha desta
// faixa que economiza um dia de trabalho — por isso ela vem em destaque e não
// como um número entre outros.

import { AlertTriangle, EyeOff, Search, HelpCircle } from "lucide-react";
import type { DiagnosticoDaVitrine, Urgencia } from "@/modules/integration/domain/diagnosticoDaVitrine";

const APRESENTACAO: Record<
  Urgencia,
  { titulo: string; explica: string; icone: typeof AlertTriangle; classe: string }
> = {
  fora_do_ar: {
    titulo: "Fora do ar",
    // O verbo importa: "pausado" soa administrativo, "ninguém encontra" diz o
    // que está acontecendo com o dinheiro.
    explica: "ninguém encontra estes anúncios agora",
    icone: EyeOff,
    classe: "border-red-500/25 bg-red-500/[0.07] text-red-300",
  },
  sob_revisao: {
    titulo: "Em revisão pelo ML",
    explica: "o Mercado Livre está analisando",
    icone: Search,
    classe: "border-amber-400/25 bg-amber-400/[0.07] text-amber-200",
  },
  penalizado: {
    titulo: "No ar, mas punidos",
    explica: "aparecem menos do que poderiam",
    icone: AlertTriangle,
    classe: "border-amber-400/20 bg-amber-400/[0.05] text-amber-200/90",
  },
  nao_sabemos: {
    titulo: "Sem aviso do ML",
    // NUNCA "saudáveis". É a lei da migração 050: `null` é não sabemos.
    explica: "nada apontado até a última leitura",
    icone: HelpCircle,
    classe: "border-white/10 bg-white/[0.03] text-zinc-400",
  },
};

/** A ordem da faixa é a ordem da urgência, e some o que está zerado. */
const VISIVEIS: readonly Urgencia[] = ["fora_do_ar", "sob_revisao", "penalizado"];

export function OQueOMercadoLivreDisse({
  diagnostico,
  aoFiltrar,
}: {
  diagnostico: DiagnosticoDaVitrine;
  /** Clicar num grupo filtra a tabela abaixo. Opcional: sem isso, é só leitura. */
  aoFiltrar?: (urgencia: Urgencia) => void;
}) {
  const comAlgo = VISIVEIS.filter((u) => diagnostico.contagem[u] > 0);

  // Nada apontado é uma notícia boa e merece uma frase, não uma faixa vazia.
  if (comAlgo.length === 0) return null;

  return (
    <section
      aria-labelledby="o-que-o-ml-disse"
      className="rounded-xl border border-white/5 bg-[#0e0e16] p-4"
    >
      <h2 id="o-que-o-ml-disse" className="text-sm font-medium text-zinc-200">
        O que o Mercado Livre já disse
      </h2>

      {diagnostico.causaDominante && (
        <p className="mt-1 text-sm text-zinc-400">
          <strong className="font-medium text-zinc-200">
            {diagnostico.causaDominante.pct}%
          </strong>{" "}
          do que ele apontou é{" "}
          <strong className="font-medium text-zinc-200">
            {diagnostico.causaDominante.causa.toLowerCase()}
          </strong>{" "}
          — {diagnostico.causaDominante.anuncios} anúncios. Resolver essa causa
          resolve quase tudo de uma vez.
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {comAlgo.map((u) => {
          const { titulo, explica, icone: Icone, classe } = APRESENTACAO[u];
          const n = diagnostico.contagem[u];
          const conteudo = (
            <>
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide">
                <Icone size={13} className="shrink-0" /> {titulo}
              </span>
              <span className="mt-1 block text-2xl font-semibold tabular-nums">{n}</span>
              <span className="mt-0.5 block text-xs opacity-80">{explica}</span>
            </>
          );
          const classeBase = `block rounded-lg border p-3 text-left ${classe}`;

          return aoFiltrar ? (
            <button
              key={u}
              type="button"
              onClick={() => aoFiltrar(u)}
              className={`${classeBase} transition-colors hover:brightness-125 [@media(pointer:coarse)]:min-h-11`}
            >
              {conteudo}
            </button>
          ) : (
            <div key={u} className={classeBase}>
              {conteudo}
            </div>
          );
        })}
      </div>

      {/* A data importa: o estado foi LIDO num instante, não é ao vivo. Sem
          isto a lojista corrige uma foto e acha que a tela está mentindo por
          não mudar na hora. */}
      <p className="mt-3 text-xs text-zinc-500">
        Isto é a leitura mais recente do Mercado Livre. Depois de corrigir, o
        estado só muda quando ele reavaliar — e quando a gente reler.
      </p>
    </section>
  );
}
