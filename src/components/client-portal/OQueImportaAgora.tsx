"use client";

// A primeira coisa da tela "Hoje" — a resposta à pergunta que dá nome à área.
//
// ===========================================================================
// ISTO NÃO É UMA TELA NOVA. É A MESMA, TRÊS POSIÇÕES ACIMA.
// ===========================================================================
//
// A lista do que está travando já existia, bem construída, com título, a
// CONSEQUÊNCIA de cada lacuna e o link para resolver — ordenada por quanto
// destrava. Ela era a terceira coisa da tela, depois de oito cartões de número
// e seis cartões de "o que você quer fazer hoje?".
//
// O que mudou: ela subiu, ganhou uma frase, e passou a mostrar TRÊS em vez de
// todas. A lógica é a mesma de sempre (`lacunasDaLoja` + `aberturaDoHoje`).

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb } from "lucide-react";
import { aberturaDoHoje } from "@/modules/portal/domain/oQueImportaAgora";
import type { EstadoDaLoja, Lacuna } from "@/modules/publication/domain/prontidaoDaLoja";

export function OQueImportaAgora({
  lacunas,
  estado,
}: {
  lacunas: Lacuna[];
  estado: EstadoDaLoja;
}) {
  const { frase, visiveis, restantes, emDia } = aberturaDoHoje(lacunas);

  if (emDia) {
    return (
      <section
        aria-labelledby="o-que-importa"
        className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5"
      >
        <h2 id="o-que-importa" className="flex items-center gap-2 text-base font-medium text-emerald-200">
          <CheckCircle2 size={18} className="shrink-0" />
          {frase}
        </h2>
      </section>
    );
  }

  const parede = visiveis.length === 1 && visiveis[0].bloqueiaTudo;

  return (
    <section
      aria-labelledby="o-que-importa"
      /* A borda muda de cor só quando algo trava TUDO. Se toda a tela fosse
         vermelha, o vermelho deixaria de significar alguma coisa — a mesma
         regra que o ícone da lista já seguia. */
      className={`rounded-xl border p-5 ${
        parede ? "border-red-500/25 bg-red-500/[0.06]" : "border-white/10 bg-[#0e0e16]"
      }`}
    >
      {/* A FRASE é o elemento primário da tela inteira. Ela é maior que os
          títulos das seções abaixo de propósito: numa tela onde tudo tinha o
          mesmo peso, dar peso a uma coisa é o conserto. */}
      <h2
        id="o-que-importa"
        className={`text-lg font-semibold tracking-tight ${parede ? "text-red-200" : "text-white"}`}
      >
        {frase}
      </h2>

      <ul className="mt-4 space-y-3">
        {visiveis.map((l) => (
          <li key={l.tipo} className="flex items-start gap-3">
            {l.bloqueiaTudo ? (
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-400" />
            ) : (
              <Lightbulb size={16} className="mt-0.5 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200">{l.titulo}</p>
              {/* A consequência, e é ela que faz alguém levantar da cadeira.
                  Sem isto a lista vira burocracia que se aprende a ignorar. */}
              <p className="mt-0.5 text-xs text-zinc-400">{l.trava}</p>
              <Link
                href={l.href}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300 [@media(pointer:coarse)]:min-h-11"
              >
                {l.cta} <ArrowRight size={12} />
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {/* O resto é CONTADO, nunca escondido. Sumir com ele seria mentir por
          omissão; mostrar tudo seria não ter decidido nada. */}
      {restantes > 0 && (
        <p className="mt-3 border-t border-white/5 pt-3 text-xs text-zinc-500">
          Mais {restantes} {restantes === 1 ? "ponto" : "pontos"} depois destes.
        </p>
      )}

      {estado.produtos > 0 && (
        <p className="mt-3 text-xs text-zinc-500">
          <strong className="text-zinc-300">{estado.prontosParaPrecificar}</strong> de{" "}
          {estado.produtos} produto(s) têm custo e peso — os únicos com preço mínimo calculado.
        </p>
      )}
    </section>
  );
}
