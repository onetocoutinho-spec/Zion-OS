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
import {
  agruparPorFamilia,
  contarCompletos,
  contarPendentes,
  pesoPendente,
  situacaoDePeso,
} from "@/modules/catalog/domain/familiaDeProduto";
import { resolverConsulta, type ResultadoConsulta } from "@/modules/catalog/domain/consultaDePeso";
import { interpretarConsulta, registrarUso } from "@/lib/services/consultaPeso";
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
  const [soPendentes, setSoPendentes] = useState(false);
  // A consulta em texto não cria uma resposta paralela: ela produz o MESMO
  // recorte que os controles produzem, e a lista abaixo é o conjunto real.
  // Resposta do modelo em cima com a tabela mostrando outra coisa seria pior
  // que não ter campo nenhum.
  const [frase, setFrase] = useState("");
  const [interpretando, setInterpretando] = useState(false);
  const [consulta, setConsulta] = useState<{ pedido: string; r: ResultadoConsulta } | null>(null);
  const [gravando, setGravando] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const familias = useMemo(() => {
    let base = produtos ?? [];
    // Consulta e filtro COMPÕEM — escrever e clicar são duas entradas da mesma
    // superfície, não dois caminhos que podem divergir.
    if (consulta && consulta.r.produtoIds.length > 0) {
      const alvo = new Set(consulta.r.produtoIds);
      base = base.filter((p) => alvo.has(p.id));
    }
    // O filtro age sobre o PRODUTO e depois reagrupa: esconder a família
    // inteira por causa de um irmão pronto tiraria da tela o que falta.
    return agruparPorFamilia(soPendentes ? base.filter(pesoPendente) : base);
  }, [produtos, soPendentes, consulta]);

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
  // Progresso por COMPLETUDE. O denominador exclui quem não tem grade: produto
  // sem variação não tem onde guardar peso, e cobrá-lo criaria uma pendência
  // que ninguém resolve nesta tela (são 3 na base real).
  const comGrade = (produtos ?? []).filter((p) => p.quantidadeVariantes > 0);
  const comPeso = contarCompletos(comGrade);
  const pendentes = contarPendentes(produtos ?? []);

  /** Interpreta a frase e resolve contra os produtos que a tela já tem. */
  async function perguntar(e: React.FormEvent) {
    e.preventDefault();
    const texto = frase.trim();
    if (!texto || interpretando) return;
    setInterpretando(true);
    setMsg(null);
    try {
      const marcas = [...new Set((produtos ?? []).map((p) => p.marca).filter(Boolean))];
      const criterio = await interpretarConsulta(texto, marcas);
      // A resolução é DAQUI, contra dado real. O modelo devolveu só critério.
      const r = resolverConsulta(criterio, produtos ?? [], marcas);
      setConsulta({ pedido: criterio.interpretacao || texto, r });
      registrarUso({
        origem: "texto",
        desfecho: r.desfecho,
        produtos: r.produtoIds.length,
        temFronteira: r.fronteira.length > 0,
        em: new Date().toISOString(),
      });
    } catch (err) {
      setConsulta(null);
      setMsg(err instanceof Error ? err.message : "Não consegui interpretar agora.");
    } finally {
      setInterpretando(false);
    }
  }

  function limparConsulta() {
    setConsulta(null);
    setFrase("");
  }

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
            <strong className="text-white">{comPeso}</strong> de {comGrade.length} produtos com o
            peso completo
          </span>
          <span className="text-xs text-white/40">{familias.length} linha(s) de produto</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-violet-500 transition-all"
            style={{ width: comGrade.length > 0 ? `${(comPeso / comGrade.length) * 100}%` : "0%" }}
          />
        </div>
        {(pendentes > 0 || soPendentes) && (
          <button
            type="button"
            onClick={() => {
              const ligando = !soPendentes;
              setSoPendentes(ligando);
              // O outro lado da medição: o mesmo recorte, alcançado por clique.
              registrarUso({
                origem: "filtro",
                desfecho: ligando ? "encontrado" : null,
                produtos: ligando ? pendentes : (produtos ?? []).length,
                temFronteira: false,
                em: new Date().toISOString(),
              });
            }}
            className={`mt-3 rounded-lg border px-2.5 py-1.5 text-xs transition-colors [@media(pointer:coarse)]:min-h-11 ${
              soPendentes
                ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                : "border-amber-500/25 bg-amber-500/[0.06] text-amber-300 hover:border-amber-500/50"
            }`}
          >
            {soPendentes ? `Ver todos · ${pendentes} com peso faltando` : `${pendentes} com peso faltando`}
          </button>
        )}
        {total > comGrade.length && (
          <p className="mt-2 text-xs text-white/35">
            {total - comGrade.length} produto(s) sem variações cadastradas ficam de fora: sem grade
            não é o mesmo que sem peso — não há onde guardar.
          </p>
        )}
        <p className="mt-3 text-xs text-white/45">
          Meça a <strong className="text-white/70">caixa fechada</strong>, como ela sai para o
          correio — não o produto nu. Peso em gramas; altura, largura e comprimento em centímetros
          são opcionais, mas sem os três o frete usa só o peso real, sem cubagem.
        </p>
      </div>


      {/* ── Perguntar em vez de filtrar ─────────────────────────────────── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <form onSubmit={perguntar} className="flex flex-wrap items-center gap-2">
          <input
            value={frase}
            onChange={(e) => setFrase(e.target.value)}
            disabled={interpretando}
            placeholder="Pergunte sobre os produtos — ex.: quais Havaianas estão sem peso?"
            className="min-w-[16rem] flex-1 rounded-lg border border-white/10 bg-[#12121c] px-3 py-2 text-sm text-zinc-200 outline-none transition-colors focus:border-violet-500 disabled:opacity-50 [@media(pointer:coarse)]:min-h-11"
          />
          <Button type="submit" disabled={interpretando || !frase.trim()}>
            {interpretando ? <Loader2 size={15} className="animate-spin" /> : <Scale size={15} />}{" "}
            {interpretando ? "Lendo…" : "Perguntar"}
          </Button>
          {consulta && (
            <button type="button" onClick={limparConsulta} className="text-xs text-white/45 hover:text-white/70">
              limpar
            </button>
          )}
        </form>

        {consulta && (
          <div className="mt-3 border-t border-white/5 pt-3 text-sm">
            {/* A interpretação vem ANTES do resultado: é ela que mostra qual
                parte virou fato e qual o Zion não sabe provar. */}
            <p className="text-white/45">
              Você pediu: <span className="text-white/75">{consulta.pedido}</span>
            </p>
            <p
              className={`mt-1 ${
                consulta.r.desfecho === "invalido"
                  ? "text-amber-300"
                  : consulta.r.desfecho === "vazio"
                    ? "text-white/60"
                    : "text-zinc-200"
              }`}
            >
              {consulta.r.mensagem}
            </p>
          </div>
        )}
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
          // Completude, não "tem algum peso": família com um produto parcial
          // dentro não está pronta, e antes ela aparecia verde.
          const feitos = contarCompletos(f.produtos);
          // AVALIÁVEIS ≠ total da família: produto sem grade não tem onde
          // guardar peso. Sem essa separação a família de um produto sem grade
          // mostrava "1 produto(s) · 0 com peso" num card VERDE — três famílias
          // na base real diziam isso.
          const avaliaveis = f.produtos.filter((p) => p.quantidadeVariantes > 0).length;
          const completa = avaliaveis > 0 && contarPendentes(f.produtos) === 0;
          const nadaAAvaliar = avaliaveis === 0;
          const aberta = abertas.has(f.chave);
          const ids = f.produtos.map((p) => p.id);
          return (
            <div
              key={f.chave}
              id={`familia-${f.chave}`}
              className={`rounded-xl border p-4 ${
                completa
                  ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                  : "border-white/10 bg-white/[0.02]"
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
                  {f.produtos.length} produto(s) ·{" "}
                  {nadaAAvaliar ? "sem variações cadastradas" : `${feitos} de ${avaliaveis} com peso`}
                  {!nadaAAvaliar && avaliaveis < f.produtos.length
                    ? ` · ${f.produtos.length - avaliaveis} sem grade`
                    : ""}
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
                      {/* Quatro estados, não dois (INC-001). O parcial existia
                          e aparecia como se estivesse pronto — 9 de 18 e 3 de
                          39 variações sumiam da tela. */}
                      {(() => {
                        const s = situacaoDePeso(p);
                        if (s === "sem_grade")
                          return <span className="text-white/35">sem variações cadastradas</span>;
                        if (s === "completo")
                          return <span className="text-emerald-400">{p.pesoGramas} g</span>;
                        if (s === "ausencia_total")
                          return <span className="text-amber-400">sem peso</span>;
                        return (
                          <span className="text-amber-400">
                            {p.variacoesSemPeso} de {p.quantidadeVariantes} variações sem peso
                          </span>
                        );
                      })()}
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
        className={`${largura} rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-right text-sm text-white outline-none focus:border-violet-500 [@media(pointer:coarse)]:min-h-11`}
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
