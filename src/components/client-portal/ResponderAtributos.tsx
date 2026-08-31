"use client";

// "O Mercado Livre precisa saber. Qual destes?"
//
// ===========================================================================
// A DIFERENÇA PARA A TELA DE CONFIRMAR, E POR QUE SÃO DUAS
// ===========================================================================
//
// `ConferirAtributos` pergunta "lemos X, confirma?" — há um valor proposto, e a
// resposta é sim ou não. Aqui não há proposta nenhuma: o obrigatório está
// vazio, e a resposta é uma escolha entre as opções que o PRÓPRIO ML publica.
//
// Juntar as duas num componente só significaria um `if` no meio de cada linha
// do JSX, e o "não é" de uma virando "escolha" da outra. São duas perguntas
// diferentes feitas à mesma pessoa; a tela mostra as duas em seções separadas.
//
// ===========================================================================
// NENHUM PALPITE ENTRA AQUI
// ===========================================================================
//
// As opções vêm de `atributosObrigatorios`, que as lê de
// `/categories/{id}/attributes`. Não há valor sugerido, não há pré-seleção, não
// há "provavelmente é este" — porque qualquer uma dessas coisas seria eu
// respondendo por ela num campo que o marketplace exige.
//
// É a lição dos 44: quando a tela facilita o caminho de menor esforço, é esse
// caminho que a pessoa toma. Aqui o menor esforço é escolher, e escolher é
// exatamente o que se quer dela.

import { useState } from "react";
import { Check, ChevronDown, HelpCircle } from "lucide-react";
import type { GrupoDePergunta } from "@/lib/services/perguntasDaCategoria";

interface Props {
  grupos: GrupoDePergunta[];
  /** Grava a escolha para todos os produtos do grupo. */
  onResponder: (grupo: GrupoDePergunta, valor: string) => Promise<void>;
}

/** Quantos produtos aparecem antes do "ver todos". */
const VISIVEIS = 3;

export function ResponderAtributos({ grupos, onResponder }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [respondidos, setRespondidos] = useState<Record<string, string>>({});
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const chaveDo = (g: GrupoDePergunta) => `${g.categoria}|${g.atributo}`;

  async function responder(g: GrupoDePergunta, valor: string) {
    const chave = chaveDo(g);
    if (ocupado) return;
    setOcupado(chave);
    try {
      await onResponder(g, valor);
      setRespondidos((r) => ({ ...r, [chave]: valor }));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <ul className="space-y-3" role="list">
      {grupos.map((g) => {
        const chave = chaveDo(g);
        const escolhido = respondidos[chave];
        const aberto = abertos.has(chave);
        const ocultos = g.produtos.length - VISIVEIS;
        const unica = g.opcoes.length === 1;

        if (escolhido) {
          return (
            <li
              key={chave}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 text-sm text-emerald-300"
            >
              <Check size={15} className="shrink-0" aria-hidden />
              <span>
                {g.atributo} <strong className="font-semibold">{escolhido}</strong> em{" "}
                {g.produtos.length} produto{g.produtos.length > 1 ? "s" : ""}.
              </span>
            </li>
          );
        }

        return (
          <li key={chave} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start gap-2">
              <HelpCircle size={16} className="mt-0.5 shrink-0 text-sky-400" aria-hidden />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {/* UMA OPÇÃO NÃO É ESCOLHA. `MLB1400 · Gênero` chega com um
                      único valor aceito, e 10 produtos caem nesse grupo:
                      perguntar "qual é o gênero?" com um botão só faz a lojista
                      procurar as outras opções que não existem. É confirmação,
                      e a tela ao lado já sabe pedir confirmação. */}
                  {unica ? (
                    <>
                      {g.produtos.length} produto{g.produtos.length > 1 ? "s" : ""}: o Mercado Livre
                      só aceita <span className="text-sky-300">{g.opcoes[0].nome}</span> aqui
                    </>
                  ) : (
                    <>
                      {g.produtos.length} produto{g.produtos.length > 1 ? "s" : ""}: qual é o{" "}
                      <span className="text-sky-300">{g.atributo.toLowerCase()}</span>?
                    </>
                  )}
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {/* A dica é do ML, quando ele escreve uma. Não invento a minha:
                      quem conhece o campo é quem o exige. */}
                  {g.dica ??
                    (unica
                      ? `${g.atributo} é exigido nesta categoria e tem um valor só. Confirmando, eles publicam.`
                      : "O Mercado Livre exige este campo nesta categoria, e só aceita as opções abaixo.")}
                </p>
              </div>
            </div>

            <ul className="mt-3 space-y-1" role="list">
              {g.produtos.slice(0, aberto ? undefined : VISIVEIS).map((p) => (
                <li
                  key={p.produtoId}
                  className="truncate rounded-lg bg-white/[0.02] px-2.5 py-1.5 text-xs text-zinc-300"
                >
                  {p.produto}
                </li>
              ))}
            </ul>

            {ocultos > 0 && (
              <button
                type="button"
                onClick={() =>
                  setAbertos((a) => {
                    const n = new Set(a);
                    if (n.has(chave)) n.delete(chave);
                    else n.add(chave);
                    return n;
                  })
                }
                aria-expanded={aberto}
                className="mt-1.5 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <ChevronDown
                  size={13}
                  className={aberto ? "rotate-180 transition-transform" : "transition-transform"}
                  aria-hidden
                />
                {aberto ? "ver menos" : `ver os outros ${ocultos}`}
              </button>
            )}

            {/* SEM PRÉ-SELEÇÃO. Nenhuma opção vem marcada, e a ordem é a que o
                ML devolveu — reordenar por "mais provável" seria eu palpitando
                com o desenho em vez de com o código. */}
            <div
              role="group"
              aria-label={unica ? `${g.atributo} — confirmar` : `${g.atributo} — escolha uma opção`}
              className="mt-3 flex flex-wrap gap-2"
            >
              {g.opcoes.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => void responder(g, o.nome)}
                  disabled={ocupado !== null}
                  className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs text-sky-100 transition-colors hover:border-sky-500/60 hover:bg-sky-500/20 disabled:opacity-50"
                >
                  {unica ? `Confirmar ${o.nome}` : o.nome}
                </button>
              ))}
              {ocupado === chave && (
                <span className="self-center text-xs text-zinc-400">gravando…</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
