"use client";

// "Esta foto serve. Ponho ela nos seus anúncios?"
//
// ===========================================================================
// POR QUE UMA COR POR BOTÃO, E NÃO UM "APLICAR TUDO"
// ===========================================================================
//
// A rota trabalha por cor, e não por acaso: a unidade é a cor porque é a
// unidade do erro. Uma capa errada aplicada em lote espalha o engano por
// dezenas de anúncios antes de alguém ver — foi o incidente de 14/08, uma foto
// de Havaianas amarelo virando capa de 10 anúncios azul-marinho.
//
// Um botão por cor mantém o estrago do tamanho de um clique. E como a rota
// devolve `restantes` quando bate o teto de 12 escritas, o botão volta dizendo
// quantos faltam em vez de fingir que terminou.
//
// ===========================================================================
// O QUE ESTA TELA NÃO DECIDE
// ===========================================================================
//
// Quais anúncios são daquela cor, se a lista nova perderia alguma foto, se o
// Mercado Livre confirmou — nada disso mora aqui. A rota recompõe o plano do
// estado de AGORA, e a frase que aparece é a que ela compôs. Repetir a conta
// aqui criaria um segundo lugar para ela divergir.

import { useState } from "react";
import Image from "next/image";
import { AlertTriangle, Check, ImageIcon, Loader2 } from "lucide-react";
import type { CapaParaAplicar } from "@/lib/services/capasParaAplicar";
import type { RespostaDaCapa } from "@/modules/catalog/domain/desfechoDaFoto";

interface Props {
  capas: CapaParaAplicar[];
  /** Chama `/api/ml/aplicar-capa` — a rota como ela é. */
  onAplicar: (capa: CapaParaAplicar) => Promise<RespostaDaCapa>;
}

type Desfecho = { resposta: RespostaDaCapa } | { erro: string };

export function AplicarCapas({ capas, onAplicar }: Props) {
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [desfechos, setDesfechos] = useState<Record<string, Desfecho>>({});

  async function aplicar(c: CapaParaAplicar) {
    if (ocupado) return;
    setOcupado(c.imagemId);
    try {
      const resposta = await onAplicar(c);
      setDesfechos((d) => ({ ...d, [c.imagemId]: { resposta } }));
    } catch (e) {
      // Exceção aqui é o caminho que a rota NÃO cobre — rede, sessão. A frase
      // não pode dizer que trocou nem que não trocou: ninguém sabe.
      setDesfechos((d) => ({
        ...d,
        [c.imagemId]: {
          erro:
            e instanceof Error
              ? `${e.message} — não sei se algo chegou ao Mercado Livre. Confira antes de tentar de novo.`
              : "Falhou antes de eu saber o resultado. Confira no Mercado Livre antes de tentar de novo.",
        },
      }));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <ul className="space-y-3" role="list">
      {capas.map((c) => {
        const d = desfechos[c.imagemId];
        const rodando = ocupado === c.imagemId;
        return (
          <li
            key={c.imagemId}
            className="flex flex-col gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:flex-row sm:items-start"
          >
            <div className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-white">
              {/* `unoptimized`: a URL é pública do Storage e já sai em 1200×1200
                  quadrada. Passar pelo otimizador só gastaria uma volta. */}
              <Image src={c.url} alt={`Capa nova de ${c.produto}, cor ${c.cor}`} fill sizes="80px" className="object-contain" unoptimized />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-zinc-100">{c.produto}</h3>
              <p className="mt-0.5 text-xs text-zinc-400">
                <span className="text-zinc-200">{c.cor || "sem cor"}</span>
                {" · "}
                {c.anunciosParados} anúncio{c.anunciosParados === 1 ? "" : "s"} parado
                {c.anunciosParados === 1 ? "" : "s"} no Mercado Livre
                {c.capaAtual ? ` · capa de hoje: ${c.capaAtual}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">
                A nova tem {c.largura ?? "?"}×{c.altura ?? "?"} — quadrada, do catálogo do fabricante.
              </p>

              {d && "resposta" in d && (
                <p
                  role="status"
                  className={
                    d.resposta.ok
                      ? "mt-2 flex items-start gap-1.5 text-xs text-emerald-300"
                      : "mt-2 flex items-start gap-1.5 text-xs text-amber-200"
                  }
                >
                  {d.resposta.ok ? (
                    <Check size={13} className="mt-0.5 shrink-0" aria-hidden />
                  ) : (
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                  )}
                  {/* A FRASE É A DA ROTA. Ela sabe quantos trocou, onde parou e
                      o que pulou; recompor aqui seria uma segunda versão da
                      verdade. Quando não há frase (409/502), o motivo é o texto. */}
                  <span>{d.resposta.frase ?? d.resposta.erro ?? "O Mercado Livre respondeu, mas sem frase."}</span>
                </p>
              )}
              {d && "erro" in d && (
                <p role="status" className="mt-2 flex items-start gap-1.5 text-xs text-amber-200">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
                  <span>{d.erro}</span>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => void aplicar(c)}
              disabled={ocupado !== null}
              className="shrink-0 rounded-lg border border-sky-500/30 bg-sky-500/15 px-4 py-2.5 text-sm font-medium text-sky-100 transition-colors hover:border-sky-500/60 hover:bg-sky-500/25 disabled:opacity-50"
            >
              {rodando ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" aria-hidden /> trocando…
                </span>
              ) : d ? (
                "Tentar de novo"
              ) : (
                <span className="flex items-center gap-1.5">
                  <ImageIcon size={14} aria-hidden /> Usar como capa
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
