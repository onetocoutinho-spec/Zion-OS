"use client";

// "Lemos isto das suas palavras-chave. Confirma?"
//
// ===========================================================================
// A PERGUNTA QUE NÃO TINHA ONDE SER FEITA
// ===========================================================================
//
// O Mercado Livre exige gênero para publicar calçado. A ficha que o modelo
// escreve traz esse campo em 159 de 400 anúncios; o resto ficava parado. A
// importação passou a ler o gênero das palavras-chave do ERP — que respondem
// 10 de 12 dos casos parados — mas o que ela lê é DEDUÇÃO, e dedução não pode
// virar afirmação no anúncio dela sem ela ver.
//
// Até 28/08 essa era uma porta fechada dos dois lados: a leitura existia e
// `fichaDoCadastro` a ignorava, porque o portal da lojista não tinha onde
// revisar nada disso — a única tela de atributos é a da equipe. Esta é o onde.
//
// ===========================================================================
// EM LOTE, E POR QUE ISSO É A DECISÃO DE DESENHO
// ===========================================================================
//
// Vinte chinelos de que se leu "Infantil" são vinte vezes a mesma pergunta.
// Produto a produto ela abandona no décimo, e as outras 350 respostas ficam
// esperando para sempre. Agrupado pelo valor lido, um toque resolve o grupo.
//
// O grupo mostra os produtos ANTES da confirmação, e não depois: confirmar sem
// ver o que se está confirmando é assinar em branco. A lista abre já visível
// nos três primeiros e o resto fica atrás de um botão, porque vinte nomes de
// chinelo empurrariam o botão de confirmar para fora da tela do telefone —
// que é onde ela está.
//
// Cada produto tem "não é" ao lado. É a saída do caso isolado sem quebrar o
// lote: o item sai do grupo e o resto continua confirmável de uma vez.
//
// ===========================================================================
// O QUE ESCONDER CUSTOU, EM 28/08/2026
// ===========================================================================
//
// A primeira versão escondia tudo além dos três primeiros. A lojista confirmou
// um grupo de 324 "Chinelo" num toque — e 44 deles não eram chinelo: havia
// "Tamanco Azaleia 19112" e "Sandália Cartago 12489" ali dentro, com o nome do
// produto dizendo o tipo certo, atrás do botão "ver os outros 321".
//
// A regra que gerava aquilo foi consertada. Isto aqui é a outra metade: quando
// o NOME do produto nomeia um tipo e o valor proposto é OUTRO, o item aparece
// SEMPRE, marcado, antes dos demais — nunca escondido pelo corte dos três.
//
// Esconder o que é rotina é economia de tela. Esconder o que se contradiz é
// economia de atenção no único lugar onde a atenção era necessária.

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Sparkles, X } from "lucide-react";
import { oNomeContradiz } from "@/modules/publication/domain/composicaoConteudo";
import type { GrupoDeProposta, ProdutoDaProposta } from "@/lib/services/propostasDeAtributo";

interface Props {
  grupos: GrupoDeProposta[];
  /** Confirma o grupo inteiro (ou o que sobrou dele). */
  onConfirmar: (atributoIds: string[]) => Promise<void>;
  /** A lojista diz que aquele produto não é isso. */
  onDescartar: (atributoId: string) => Promise<void>;
}

/** Quantos produtos aparecem antes do "ver todos" — ver o comentário do topo. */
const VISIVEIS = 3;

export function ConferirAtributos({ grupos, onConfirmar, onDescartar }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [resolvidos, setResolvidos] = useState<Record<string, number>>({});
  const [descartados, setDescartados] = useState<Set<string>>(new Set());
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const chaveDo = (g: GrupoDeProposta) => `${g.atributo}|${g.valor}`;
  const restantes = (g: GrupoDeProposta) => g.produtos.filter((p) => !descartados.has(p.atributoId));

  /** Os que se contradizem primeiro, e SEMPRE visíveis. Ver o topo do arquivo. */
  function ordenados(g: GrupoDeProposta): { p: ProdutoDaProposta; contradiz: boolean }[] {
    const com = restantes(g).map((p) => ({ p, contradiz: oNomeContradiz(p.produto, g.valor) }));
    return [...com.filter((x) => x.contradiz), ...com.filter((x) => !x.contradiz)];
  }

  async function confirmar(g: GrupoDeProposta) {
    const chave = chaveDo(g);
    if (ocupado) return;
    const ids = restantes(g).map((p) => p.atributoId);
    if (ids.length === 0) return;
    setOcupado(chave);
    try {
      await onConfirmar(ids);
      setResolvidos((r) => ({ ...r, [chave]: ids.length }));
    } finally {
      setOcupado(null);
    }
  }

  async function descartar(atributoId: string) {
    if (ocupado) return;
    setOcupado(atributoId);
    try {
      await onDescartar(atributoId);
      setDescartados((d) => new Set(d).add(atributoId));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <ul className="space-y-3" role="list">
      {grupos.map((g) => {
        const chave = chaveDo(g);
        const confirmados = resolvidos[chave];
        const lista = restantes(g);
        const comMarca = ordenados(g);
        const contradizem = comMarca.filter((x) => x.contradiz).length;
        const aberto = abertos.has(chave);
        // O corte dos três NUNCA esconde uma contradição: o mínimo visível é o
        // número delas. Ver o topo do arquivo — foi assim que 44 valores
        // errados entraram num toque.
        const visiveis = Math.max(VISIVEIS, contradizem);
        const ocultos = lista.length - visiveis;

        if (confirmados !== undefined) {
          return (
            <li
              key={chave}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] px-4 py-3 text-sm text-emerald-300"
            >
              <Check size={15} className="shrink-0" aria-hidden />
              <span>
                {g.atributo} <strong className="font-semibold">{g.valor}</strong> confirmado em{" "}
                {confirmados} produto{confirmados > 1 ? "s" : ""}.
              </span>
            </li>
          );
        }

        if (lista.length === 0) {
          return (
            <li
              key={chave}
              className="rounded-xl border border-white/5 bg-black/20 px-4 py-3 text-sm text-zinc-400"
            >
              {g.atributo} {g.valor} — todos os produtos foram recusados.
            </li>
          );
        }

        return (
          <li key={chave} className="rounded-xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-start gap-2">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-violet-400" aria-hidden />
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {lista.length} produto{lista.length > 1 ? "s" : ""}: lemos{" "}
                  <span className="text-violet-300">{g.valor}</span>
                </h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {g.atributo}, tirado das palavras-chave do seu ERP. O Mercado Livre pede este
                  campo — confirmando, eles publicam.
                </p>
              </div>
            </div>

            {contradizem > 0 && (
              <p
                role="status"
                className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-200"
              >
                {contradizem === 1
                  ? "1 produto tem outro tipo no próprio nome"
                  : `${contradizem} produtos têm outro tipo no próprio nome`}{" "}
                — estão marcados abaixo. Confirmando o grupo, eles vão junto.
              </p>
            )}

            <ul className="mt-3 space-y-1" role="list">
              {comMarca.slice(0, aberto ? undefined : visiveis).map(({ p, contradiz }) => (
                <li
                  key={p.atributoId}
                  className={
                    contradiz
                      ? "flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-1.5"
                      : "flex items-center gap-2 rounded-lg bg-white/[0.02] px-2.5 py-1.5"
                  }
                >
                  {contradiz && (
                    <AlertTriangle size={12} className="shrink-0 text-amber-400" aria-hidden />
                  )}
                  <span
                    className={
                      contradiz
                        ? "min-w-0 flex-1 truncate text-xs text-amber-100"
                        : "min-w-0 flex-1 truncate text-xs text-zinc-300"
                    }
                  >
                    {p.produto}
                    {contradiz && <span className="sr-only"> — o nome diz outro tipo</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => void descartar(p.atributoId)}
                    disabled={ocupado !== null}
                    aria-label={`${p.produto} não é ${g.valor}`}
                    className="shrink-0 rounded px-2 py-1 text-[11px] text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 disabled:opacity-40"
                  >
                    <X size={11} className="mr-0.5 inline" aria-hidden />
                    não é
                  </button>
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

            <button
              type="button"
              onClick={() => void confirmar(g)}
              disabled={ocupado !== null}
              className="mt-3 w-full rounded-lg border border-violet-500/30 bg-violet-500/15 px-4 py-2.5 text-sm font-medium text-violet-100 transition-colors hover:border-violet-500/60 hover:bg-violet-500/25 disabled:opacity-50 sm:w-auto"
            >
              {ocupado === chave
                ? "confirmando…"
                : `Confirmar ${g.valor} nos ${lista.length}`}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
