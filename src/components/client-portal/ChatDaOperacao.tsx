"use client";

/**
 * O chat da operação — perguntar em português sobre a própria loja.
 *
 * A divisão do trabalho é a que o EXP-004 mediu e o EXP-005 confirmou:
 *
 *   o modelo traduz a intenção · o código responde com o dado real
 *
 * A rota classifica a frase e devolve uma intenção. O domínio resolve essa
 * intenção contra o estado que ESTA tela já carregou do banco. Nenhum número
 * que aparece aqui passou pelo modelo — ele nunca viu contagem nenhuma.
 *
 * Por isso o chat pode dizer "não sei" sem constrangimento: a lista do que ele
 * sabe responder é fechada e vem do domínio, não de uma promessa de marketing.
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Send, AlertTriangle, Lightbulb, CheckCircle2, Loader2 } from "lucide-react";
import { classificarPergunta } from "@/lib/services/assistenteDaOperacao";
import {
  responder,
  type ContextoDaPergunta,
  type RespostaDaOperacao,
} from "@/modules/assistant/domain/perguntaDaOperacao";

/** Um turno da conversa. A pergunta é do operador; a resposta é do domínio. */
interface Turno {
  pergunta: string;
  /** O que o modelo entendeu. Mostrado em cinza — é auditoria, não resposta. */
  interpretacao?: string;
  resposta?: RespostaDaOperacao;
  erro?: string;
}

/**
 * Sugestões de partida.
 *
 * Uma caixa de texto vazia com "pergunte alguma coisa" transfere para quem
 * pergunta o trabalho de adivinhar o vocabulário. Estas três são clicáveis e
 * cobrem os três formatos de resposta — número, passo e lista.
 */
const SUGESTOES_LOJA = [
  "O que eu resolvo primeiro?",
  "Quantos produtos estão sem custo?",
  "Por que não consigo precificar?",
];

const SUGESTOES_PRODUTO = [
  "O que falta neste produto?",
  "Por que ele não pode ser anunciado?",
  "Quantos produtos estão sem peso?",
];

export function ChatDaOperacao({
  contexto,
  titulo = "Pergunte sobre a sua loja",
}: {
  contexto: ContextoDaPergunta;
  titulo?: string;
}) {
  const [frase, setFrase] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turnos]);

  const perguntar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      if (!pergunta || ocupado) return;
      setFrase("");
      setOcupado(true);
      setTurnos((t) => [...t, { pergunta }]);
      try {
        const criterio = await classificarPergunta(pergunta, contexto.produto?.nome);
        // A resposta é montada AQUI, contra o estado real. O que voltou do
        // servidor foi só a intenção.
        const resposta = responder(criterio, contexto);
        setTurnos((t) =>
          t.map((turno, i) =>
            i === t.length - 1 ? { ...turno, resposta, interpretacao: criterio.interpretacao } : turno
          )
        );
      } catch (e) {
        const erro = e instanceof Error ? e.message : "Não consegui responder agora.";
        setTurnos((t) => t.map((turno, i) => (i === t.length - 1 ? { ...turno, erro } : turno)));
      } finally {
        setOcupado(false);
      }
    },
    [contexto, ocupado]
  );

  const sugestoes = contexto.produto ? SUGESTOES_PRODUTO : SUGESTOES_LOJA;

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-violet-400" />
        <h3 className="text-sm font-medium text-zinc-200">{titulo}</h3>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Respondo com os seus números — e digo quando não sei.
      </p>

      {turnos.length > 0 && (
        <div className="mt-4 max-h-96 space-y-4 overflow-y-auto pr-1">
          {turnos.map((t, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm font-medium text-zinc-300">
                <span className="text-zinc-500">Você: </span>
                {t.pergunta}
              </p>
              {t.erro ? (
                <p className="flex items-start gap-2 text-sm text-amber-300">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  {t.erro}
                </p>
              ) : t.resposta ? (
                <Resposta r={t.resposta} interpretacao={t.interpretacao} />
              ) : (
                <p className="flex items-center gap-2 text-sm text-zinc-500">
                  <Loader2 size={14} className="animate-spin" /> Lendo os seus dados…
                </p>
              )}
            </div>
          ))}
          <div ref={fimDaLista} />
        </div>
      )}

      {turnos.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void perguntar(s)}
              disabled={ocupado}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-400 transition hover:border-violet-400/40 hover:text-violet-300 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void perguntar(frase);
        }}
      >
        <input
          value={frase}
          onChange={(e) => setFrase(e.target.value)}
          placeholder={contexto.produto ? "O que falta neste produto?" : "O que eu resolvo primeiro?"}
          disabled={ocupado}
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-violet-400/50 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={ocupado || !frase.trim()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          <span className="hidden sm:inline">Perguntar</span>
        </button>
      </form>
    </div>
  );
}

/**
 * Cada formato de resposta tem sua forma na tela.
 *
 * O `switch` é exaustivo de propósito: a união discriminada do domínio faz de
 * esquecer um caso um erro de compilação, e não uma tela em branco.
 */
function Resposta({ r, interpretacao }: { r: RespostaDaOperacao; interpretacao?: string }) {
  // A linha de auditoria some quando repetiria a resposta. Em "fora do alcance"
  // a frase É a interpretação do modelo, e "Entendi: <a mesma frase>" só ocupa
  // espaço dizendo duas vezes a mesma coisa.
  const entendi =
    interpretacao && interpretacao.trim() !== r.frase.trim() ? (
      <p className="text-[11px] text-zinc-600">Entendi: {interpretacao}</p>
    ) : null;

  switch (r.tipo) {
    case "numero":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          {r.href && r.cta && (
            <Link
              href={r.href}
              className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
            >
              {r.cta} <ArrowRight size={12} />
            </Link>
          )}
          {entendi}
        </div>
      );

    case "passo":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/20 p-3">
            {r.lacuna.bloqueiaTudo ? (
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
            ) : (
              <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-400" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">{r.lacuna.titulo}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{r.lacuna.trava}</p>
              <Link
                href={r.lacuna.href}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
              >
                {r.lacuna.cta} <ArrowRight size={12} />
              </Link>
            </div>
          </div>
          {entendi}
        </div>
      );

    case "lista":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          <ul className="space-y-2">
            {r.itens.map((l) => (
              <li key={l.tipo} className="flex items-start gap-2">
                {l.bloqueiaTudo ? (
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-400" />
                ) : (
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-300">{l.titulo}</p>
                  <Link
                    href={l.href}
                    className="text-xs font-medium text-violet-400 hover:text-violet-300"
                  >
                    {l.cta}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          {entendi}
        </div>
      );

    case "produto":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          {r.itens.length > 0 && (
            <ul className="space-y-1.5">
              {r.itens.map((l) => (
                <li key={l.tipo} className="flex items-start gap-2">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-300">{l.rotulo}</p>
                    <p className="text-xs text-zinc-500">{l.impede}</p>
                    {l.href && (
                      <Link
                        href={l.href}
                        className="text-xs font-medium text-violet-400 hover:text-violet-300"
                      >
                        Resolver
                      </Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {entendi}
        </div>
      );

    case "nada_travado":
      return (
        <div className="space-y-1.5">
          <p className="flex items-center gap-2 text-sm text-zinc-200">
            <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />
            {r.frase}
          </p>
          {entendi}
        </div>
      );

    case "perguntar":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          {entendi}
        </div>
      );

    case "nao_sei":
      return (
        <div className="space-y-1.5">
          <p className="text-sm text-zinc-200">{r.frase}</p>
          <div className="rounded-lg border border-white/5 bg-black/20 p-3">
            <p className="text-xs font-medium text-zinc-400">O que eu consigo responder:</p>
            <ul className="mt-1.5 space-y-1">
              {r.posso.map((p) => (
                <li key={p} className="text-xs text-zinc-500">
                  · {p}
                </li>
              ))}
            </ul>
          </div>
          {entendi}
        </div>
      );
  }
}
