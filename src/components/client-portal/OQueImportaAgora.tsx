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

/**
 * A saudação fica PEQUENA, e isso é a metade do conserto.
 *
 * Medido na tela em 06/08, depois de subir a resposta para o topo: "Olá,
 * Leilane 👋" saía em **24px** e "4 coisas estão travando sua loja" em **18px**.
 * Eu tinha movido a resposta para o primeiro lugar e a deixado visualmente
 * subordinada a um cumprimento — o mesmo defeito que este trabalho diagnostica
 * ("nada tem peso diferente de nada"), reproduzido pelo próprio conserto.
 *
 * A saudação continua: calor não custa hierarquia quando é uma linha pequena
 * acima do que importa. O que saiu foi o subtítulo genérico ("Este é o seu
 * painel. Aqui você acompanha a saúde da sua loja…") — quatorze pixels de texto
 * que não diz nada, entre o nome dela e o fato.
 */
function Saudacao({ nome }: { nome: string }) {
  return <p className="text-sm text-zinc-400">Olá, {nome} 👋</p>;
}

export function OQueImportaAgora({
  lacunas,
  estado,
  nome,
  acao,
}: {
  lacunas: Lacuna[];
  estado: EstadoDaLoja;
  nome: string;
  /** A pílula de quota. Fica na mesma linha do fato, não numa faixa própria. */
  acao?: React.ReactNode;
}) {
  const { frase, visiveis, restantes, emDia } = aberturaDoHoje(lacunas);

  if (emDia) {
    return (
      <section
        aria-labelledby="o-que-importa"
        className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Saudacao nome={nome} />
            <h1
              id="o-que-importa"
              className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-emerald-200 sm:text-2xl"
            >
              <CheckCircle2 size={20} className="shrink-0" />
              {frase}
            </h1>
          </div>
          {acao}
        </div>
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
      {/* A FRASE é o elemento primário da tela inteira, e o tamanho diz isso.
          Ela é o `h1`: numa tela onde tudo tinha o mesmo peso, dar peso a uma
          coisa é o conserto — e o cumprimento não pode ser essa coisa. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Saudacao nome={nome} />
          <h1
            id="o-que-importa"
            className={`mt-1 text-xl font-semibold tracking-tight sm:text-2xl ${
              parede ? "text-red-200" : "text-white"
            }`}
          >
            {frase}
          </h1>
        </div>
        {acao}
      </div>

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
