"use client";

// Peso e caixa — a tela que destrava o preço mínimo.
//
// Sem peso não há frete, e sem frete `precoMinimo` devolve pendência: a tela de
// precificação diz "falta frete" e para por aí. Na base do primeiro lojista
// eram 0 de 3.085 variantes com peso, com custo e preço já presentes. A
// calculadora estava correta e muda por falta de UMA entrada.
//
// POR QUE POR FAMÍLIA
//
// Pedir o peso produto a produto seria pedir para a pessoa desistir no meio.
// Num catálogo de calçados os produtos vêm em linhas: "Moleca 5556.100 Tira
// Preta" e "Moleca 5556.100 T/pro/cac" são a mesma peça em cores diferentes e
// pesam o mesmo. Medido: 73 produtos formam 42 famílias, e Havaianas sozinha
// tem 13 produtos.
//
// O agrupamento PROPÕE; quem confirma é o lojista, e ele pode abrir a família e
// dar um peso diferente a um produto específico. Mesma regra que a importação
// de planilha aprendeu do jeito difícil: semelhança propõe, humano decide.

import { useMemo, useState, useEffect, Suspense } from "react";
import { Check, ChevronDown, ChevronRight, Loader2, Scale } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/client-portal/ui";
import { useClientPortal } from "@/components/client-portal/context";
import { useLiveQuery } from "@/lib/hooks";
import { listarProdutosComPeso, definirPesoDosProdutos } from "@/lib/services/pesoDeProduto";
import { agruparPorFamilia, contarComPeso } from "@/modules/catalog/domain/familiaDeProduto";
import { formatBRL } from "@/lib/format";
import { useSearchParams } from "next/navigation";

/**
 * A tela abre focada num produto quando vem de `?produto=<id>`.
 *
 * Sem isso o chip "peso" da lista levava para 42 famílias fechadas, e a pessoa
 * tinha que procurar de novo o produto que ela acabou de ver. O caminho existia
 * e não continuava — que é o custo real de ter quatro telas no mesmo assunto.
 */
function PesoDosProdutosInterno() {
  const { clienteId } = useClientPortal();
  const params = useSearchParams();
  const produtoAlvo = params.get("produto");
  const { data: produtos, reload } = useLiveQuery(
    () => listarProdutosComPeso(clienteId),
    [clienteId]
  );

  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const [gravando, setGravando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const familias = useMemo(() => agruparPorFamilia(produtos ?? []), [produtos]);

  /** A família do produto pedido no endereço, se houver. */
  const familiaAlvo = useMemo(
    () => (produtoAlvo ? familias.find((f) => f.produtos.some((p) => p.id === produtoAlvo)) : undefined),
    [familias, produtoAlvo]
  );

  // Abre e rola até ela, uma vez. `focou` impede que reabrir aconteça a cada
  // render — reabrir o que a pessoa fechou seria brigar com ela.
  const [focou, setFocou] = useState(false);
  useEffect(() => {
    if (focou || !familiaAlvo) return;
    setFocou(true);
    setAbertas((s) => new Set(s).add(familiaAlvo.chave));
    // O rAF espera a família abrir antes de medir para onde rolar.
    requestAnimationFrame(() =>
      document.getElementById(`familia-${familiaAlvo.chave}`)?.scrollIntoView({ block: "center" })
    );
  }, [focou, familiaAlvo]);
  const total = produtos?.length ?? 0;
  const comPeso = contarComPeso(produtos ?? []);

  async function gravar(chave: string, ids: string[], form: HTMLFormElement) {
    const dado = new FormData(form);
    const n = (k: string) => Number(String(dado.get(k) ?? "").replace(",", ".")) || 0;
    const pesoGramas = n("peso");
    if (pesoGramas <= 0) {
      setMsg("Informe o peso em gramas — zero não é peso, é a falta dele.");
      return;
    }
    setGravando(chave);
    setMsg(null);
    try {
      const r = await definirPesoDosProdutos(clienteId, ids, {
        pesoGramas,
        alturaCm: n("altura"),
        larguraCm: n("largura"),
        comprimentoCm: n("comprimento"),
      });
      setMsg(`${r.produtos} produto(s) e ${r.variantes} variação(ões) com peso.`);
      reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Não foi possível gravar o peso agora.");
    } finally {
      setGravando(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Peso e caixa"
        subtitulo="O frete do Mercado Livre é cobrado por peso. Sem ele, o preço mínimo não sai."
      />

      {/* ── Onde a pessoa está ──────────────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-white/70">
            <strong className="text-white">{comPeso}</strong> de {total} produtos com peso
          </span>
          <span className="text-xs text-white/40">{familias.length} linha(s) de produto</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: total > 0 ? `${(comPeso / total) * 100}%` : "0%" }}
          />
        </div>
        <p className="mt-3 text-xs text-white/45">
          Meça a <strong className="text-white/70">caixa fechada</strong>, como ela sai para o
          correio — não o produto nu. Peso em gramas; altura, largura e comprimento em centímetros
          são opcionais, mas sem os três o frete usa só o peso real, sem cubagem.
        </p>
      </div>

      {msg && (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-400">
          <Check size={15} /> {msg}
        </p>
      )}

      {!produtos && <p className="text-sm text-white/40">Carregando…</p>}

      {/* ── Uma linha por família ───────────────────────────────────────── */}
      <div className="space-y-2">
        {familias.map((f) => {
          const feitos = contarComPeso(f.produtos);
          const completa = feitos === f.produtos.length;
          const aberta = abertas.has(f.chave);
          const ids = f.produtos.map((p) => p.id);
          return (
            <div
              key={f.chave}
              id={`familia-${f.chave}`}
              className={`rounded-xl border p-4 ${
                completa ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() =>
                    setAbertas((s) => {
                      const n = new Set(s);
                      if (n.has(f.chave)) n.delete(f.chave);
                      else n.add(f.chave);
                      return n;
                    })
                  }
                  className="flex items-center gap-1.5 text-sm font-medium hover:text-violet-300 [@media(pointer:coarse)]:min-h-11"
                >
                  {aberta ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  {f.titulo}
                </button>
                <span className="text-xs text-white/40">
                  {f.produtos.length} produto(s) · {feitos} com peso
                </span>
                {completa && <Check size={15} className="text-emerald-400" />}

                <form
                  className="ml-auto flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void gravar(f.chave, ids, e.currentTarget);
                  }}
                >
                  <Campo nome="peso" rotulo="g" largura="w-20" padrao={f.produtos[0]?.pesoGramas} />
                  <Campo nome="altura" rotulo="alt" padrao={f.produtos[0]?.alturaCm} />
                  <Campo nome="largura" rotulo="larg" padrao={f.produtos[0]?.larguraCm} />
                  <Campo nome="comprimento" rotulo="comp" padrao={f.produtos[0]?.comprimentoCm} />
                  <Button type="submit" disabled={gravando === f.chave}>
                    {gravando === f.chave ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Scale size={14} />
                    )}
                    Aplicar
                  </Button>
                </form>
              </div>

              {aberta && (
                <ul className="mt-3 space-y-1 border-t border-white/5 pt-3 text-xs text-white/55">
                  {f.produtos.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 truncate">{p.nome}</span>
                      <span className="text-white/35">{p.quantidadeVariantes} var.</span>
                      {p.custo > 0 && <span className="text-white/35">custo {formatBRL(p.custo)}</span>}
                      <span className={p.pesoGramas > 0 ? "text-emerald-400" : "text-amber-400"}>
                        {p.pesoGramas > 0 ? `${p.pesoGramas} g` : "sem peso"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {produtos && familias.length === 0 && (
        <p className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-sm text-white/40">
          Nenhum produto na base ainda.
        </p>
      )}
    </div>
  );
}

function Campo({
  nome,
  rotulo,
  padrao,
  largura = "w-16",
}: {
  nome: string;
  rotulo: string;
  padrao?: number;
  largura?: string;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-white/40">
      <input
        name={nome}
        type="text"
        inputMode="decimal"
        defaultValue={padrao && padrao > 0 ? String(padrao) : ""}
        placeholder="—"
        className={`${largura} rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-sm text-white outline-none focus:border-violet-500/40 [@media(pointer:coarse)]:min-h-11`}
      />
      {rotulo}
    </label>
  );
}

/**
 * `useSearchParams` obriga um limite de Suspense no App Router — sem ele a
 * página inteira vira renderização sob demanda no cliente.
 */
export default function PesoDosProdutos() {
  return (
    <Suspense fallback={null}>
      <PesoDosProdutosInterno />
    </Suspense>
  );
}
