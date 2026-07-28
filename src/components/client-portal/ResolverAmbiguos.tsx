"use client";

// A outra metade da recusa.
//
// A importação de custos recusa gravar quando duas linhas da planilha
// reivindicam o mesmo produto com custos DIFERENTES — não há resposta certa, e
// chutar uma gravaria custo errado em silêncio. Isso está certo.
//
// O que estava errado era parar aí. O relatório dizia "17 produto(s)
// ambíguo(s), deixados de fora" e mais nada: o lojista sabia que tinha perdido
// 17 custos, sem saber quais nem por quê, e sem nenhum caminho para resolver.
// Recusar só é honesto quando a pessoa PODE decidir.
//
// Aqui ela decide. Cada produto mostra os custos em disputa e de qual linha da
// planilha cada um veio — porque é o nome da linha que explica o conflito ("o
// mesmo modelo em duas cores, comprado em datas diferentes"), e sem ele a
// escolha seria entre dois números sem história.

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { formatBRLExato } from "@/lib/format";
import type { AmbiguidadeCusto } from "@/lib/services/importacaoCustos";

interface Props {
  itens: AmbiguidadeCusto[];
  /** Recebe a escolha; devolve quando terminou de gravar. */
  onEscolher: (produtoId: string, custo: number) => Promise<void>;
}

export function ResolverAmbiguos({ itens, onEscolher }: Props) {
  const [gravando, setGravando] = useState<string | null>(null);
  const [resolvidos, setResolvidos] = useState<Record<string, number>>({});

  async function escolher(produtoId: string, custo: number) {
    if (gravando) return;
    setGravando(produtoId);
    try {
      await onEscolher(produtoId, custo);
      setResolvidos((r) => ({ ...r, [produtoId]: custo }));
    } finally {
      setGravando(null);
    }
  }

  const pendentes = itens.filter((i) => resolvidos[i.produtoId] === undefined);

  return (
    <div className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4">
      <div className="flex items-start gap-2">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
        <div>
          <h3 className="text-sm font-semibold text-amber-200">
            {pendentes.length > 0
              ? `${pendentes.length} produto(s) com mais de um custo`
              : "Tudo resolvido"}
          </h3>
          <p className="mt-0.5 text-xs text-amber-200/70">
            A planilha traz custos diferentes para o mesmo produto. O Zion não escolhe por você —
            quem sabe qual é o certo é quem compra.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {itens.map((item) => {
          const escolhido = resolvidos[item.produtoId];
          return (
            <li
              key={item.produtoId}
              className="rounded-lg border border-white/5 bg-black/20 p-3"
            >
              <p className="text-sm text-zinc-200">{item.produto}</p>
              {escolhido !== undefined ? (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400">
                  <Check size={13} /> Gravado {formatBRLExato(escolhido)}
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {item.candidatos.map((c) => (
                    <button
                      key={`${c.custo}-${c.origem}`}
                      type="button"
                      onClick={() => void escolher(item.produtoId, c.custo)}
                      disabled={gravando !== null}
                      title={`Da linha: ${c.origem}`}
                      className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-1.5 text-left text-xs text-violet-200 hover:border-violet-500/50 disabled:opacity-50"
                    >
                      <span className="font-semibold">{formatBRLExato(c.custo)}</span>
                      {/* A origem é o que dá sentido à escolha: dois números
                          sem história não são uma decisão, são um sorteio. */}
                      <span className="mt-0.5 block max-w-[16rem] truncate text-[11px] text-violet-200/50">
                        {c.origem}
                      </span>
                    </button>
                  ))}
                  {gravando === item.produtoId && (
                    <span className="self-center text-xs text-zinc-400">gravando…</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
