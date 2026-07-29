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
import {
  Sparkles,
  ArrowRight,
  Send,
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Loader2,
  MessagesSquare,
} from "lucide-react";
import { classificarPergunta } from "@/lib/services/assistenteDaOperacao";
import { conversar } from "@/lib/services/conversaDoAssistente";
import { Markdown } from "@/components/client-portal/Markdown";
import type { Fala } from "@/lib/agentes/conversaComFerramentas";
import { executarProposta } from "@/lib/services/correcaoPeloChat";
import {
  montarProposta,
  type Proposta,
  type ProdutoAlvo,
} from "@/modules/assistant/domain/propostaDeCorrecao";
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
  /**
   * Uma mudança PROPOSTA, ainda não executada.
   *
   * Fica aqui e não numa variável de estado solta porque a confirmação
   * pertence ao turno: se a pessoa perguntar outra coisa antes de confirmar, a
   * proposta antiga continua visível no seu lugar, em vez de o botão "Gravar"
   * flutuar na tela apontando para algo que já saiu de vista.
   */
  proposta?: Proposta;
  /** O que aconteceu depois de confirmar. Trava o cartão contra duplo clique. */
  desfecho?: { ok: boolean; mensagem: string; cegoParaAIL: boolean };
  /** No modo conversa: a fala do assistente, escrita por ele. */
  texto?: string;
  /**
   * Quais ferramentas rodaram para produzir esta resposta.
   *
   * Fica visível de propósito. É a única forma de quem lê saber se um número
   * veio do banco ou de lugar nenhum — e num chat que conversa livre, essa
   * distinção não se enxerga pela forma da frase.
   */
  ferramentas?: readonly string[];
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
  produtos = [],
  clienteId,
  titulo = "Pergunte sobre a sua loja",
  aoGravar,
}: {
  /**
   * `null` enquanto os dados carregam — e o chat NÃO some por isso.
   *
   * Ele já sumiu: a tela montava com `{contexto && <ChatDaOperacao/>}`, e
   * bastava uma das quatro consultas recarregar para o contexto ficar nulo por
   * um instante, o React destruir o componente e a conversa inteira ir junto —
   * no meio de uma resposta. Aceitar `null` aqui é o que mantém o componente
   * vivo; ele só desabilita a entrada enquanto não sabe os números.
   */
  contexto: ContextoDaPergunta | null;
  /** O catálogo, para o código resolver de QUAL produto a frase fala. */
  produtos?: readonly ProdutoAlvo[];
  clienteId: string;
  titulo?: string;
  /** Chamado depois de uma gravação, para a tela recarregar o que mudou. */
  aoGravar?: () => void;
}) {
  const [frase, setFrase] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [ocupado, setOcupado] = useState(false);
  /**
   * Modo conversa: o laço com ferramentas, que guarda o fio e conduz.
   *
   * Fica DESLIGADO por padrão porque custa de 6 a 19 vezes mais que a rota de
   * intenção (medido: ~2.600 tokens por conversa contra ~400 por pergunta), e a
   * maioria das perguntas é uma só — "quantos sem custo?" não precisa de fio.
   *
   * Os dois vivem lado a lado de propósito. Trocar um pelo outro deixaria a
   * operação sem base de comparação e sem saída se o custo doer.
   */
  const [conversando, setConversando] = useState(false);
  /** O fio. Vive aqui, não no servidor: fechar a aba encerra a conversa. */
  const [falas, setFalas] = useState<readonly Fala[]>([]);
  const fimDaLista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fimDaLista.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [turnos]);

  const perguntar = useCallback(
    async (texto: string) => {
      const pergunta = texto.trim();
      // Sem contexto não há resposta honesta: responder com zeros seria pior
      // que esperar meio segundo.
      if (!pergunta || ocupado || !contexto) return;
      setFrase("");
      setOcupado(true);
      setTurnos((t) => [...t, { pergunta }]);
      try {
        if (conversando) {
          // O texto e o rastro de ferramenta chegam ao vivo, no lugar do
          // "Lendo os seus dados…" parado. Com ferramentas, uma resposta leva
          // de 2 a 8 segundos — tempo demais para uma tela muda.
          const aoVivo = {
            aoTexto: (acumulado: string) =>
              setTurnos((t) =>
                t.map((turno, i) => (i === t.length - 1 ? { ...turno, texto: acumulado } : turno))
              ),
            aoFerramenta: (nomeDaFerramenta: string) =>
              setTurnos((t) =>
                t.map((turno, i) =>
                  i === t.length - 1
                    ? { ...turno, ferramentas: [...(turno.ferramentas ?? []), nomeDaFerramenta] }
                    : turno
                )
              ),
          };
          const r = await conversar(
            pergunta,
            falas,
            { pergunta: contexto, produtos, produtoAberto: contexto.produto ?? null },
            contexto.produto?.nome,
            aoVivo
          );
          setFalas(r.falas);
          setTurnos((t) =>
            t.map((turno, i) =>
              i === t.length - 1
                ? {
                    ...turno,
                    texto: r.texto,
                    ferramentas: r.ferramentas,
                    ...(r.proposta ? { proposta: r.proposta } : {}),
                  }
                : turno
            )
          );
          return;
        }
        const criterio = await classificarPergunta(pergunta, contexto.produto?.nome);
        // Ditar um valor não é perguntar. Vira PROPOSTA — nada é gravado até
        // alguém ler o cartão e clicar. Ver `propostaDeCorrecao`.
        const encerra =
          criterio.intencao === "preencher"
            ? {
                proposta: montarProposta(
                  criterio,
                  produtos,
                  contexto.produto
                    ? { id: contexto.produto.id, nome: contexto.produto.nome }
                    : null
                ),
              }
            : // A resposta é montada AQUI, contra o estado real. O que voltou do
              // servidor foi só a intenção.
              { resposta: responder(criterio, contexto) };
        setTurnos((t) =>
          t.map((turno, i) =>
            i === t.length - 1
              ? { ...turno, ...encerra, interpretacao: criterio.interpretacao }
              : turno
          )
        );
      } catch (e) {
        const erro = e instanceof Error ? e.message : "Não consegui responder agora.";
        setTurnos((t) => t.map((turno, i) => (i === t.length - 1 ? { ...turno, erro } : turno)));
      } finally {
        setOcupado(false);
      }
    },
    [contexto, ocupado, produtos, conversando, falas]
  );

  /**
   * Grava — só a partir de uma proposta que já está na tela.
   *
   * O índice do turno é o que amarra o cartão à gravação: `executarProposta`
   * recebe o objeto que a pessoa leu, não campos remontados a partir da frase.
   */
  const confirmar = useCallback(
    async (indice: number) => {
      const alvo = turnos[indice];
      const p = alvo?.proposta;
      if (!p || p.tipo !== "pronta" || alvo.desfecho || ocupado) return;
      setOcupado(true);
      try {
        const r = await executarProposta(clienteId, p);
        setTurnos((t) => t.map((turno, i) => (i === indice ? { ...turno, desfecho: r } : turno)));
        if (r.ok) aoGravar?.();
      } catch (e) {
        const erro = e instanceof Error ? e.message : "Não consegui gravar.";
        setTurnos((t) =>
          t.map((turno, i) =>
            i === indice
              ? { ...turno, desfecho: { ok: false, mensagem: erro, cegoParaAIL: false } }
              : turno
          )
        );
      } finally {
        setOcupado(false);
      }
    },
    [turnos, clienteId, ocupado, aoGravar]
  );

  /** Descarta a proposta sem gravar. O turno some da lista de pendentes. */
  const descartar = useCallback((indice: number) => {
    setTurnos((t) =>
      t.map((turno, i) =>
        i === indice
          ? { ...turno, desfecho: { ok: false, mensagem: "Descartado. Nada foi gravado.", cegoParaAIL: false } }
          : turno
      )
    );
  }, []);

  const sugestoes = contexto?.produto ? SUGESTOES_PRODUTO : SUGESTOES_LOJA;

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-violet-400" />
        <h3 className="text-sm font-medium text-zinc-200">{titulo}</h3>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        Respondo com os seus números — e digo quando não sei.
      </p>

      {/* O interruptor entre os dois modos.
          Aparece porque a diferença é real e o lojista sente: o modo conversa
          guarda o fio e conduz, e custa de 6 a 19 vezes mais. Esconder isso
          faria a conta chegar sem explicação. Trocar de modo limpa o fio — o
          histórico de um não serve ao outro. */}
      <button
        type="button"
        onClick={() => {
          setConversando((v) => !v);
          setFalas([]);
        }}
        disabled={ocupado}
        className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-zinc-500 transition hover:text-violet-300 disabled:opacity-50"
      >
        <MessagesSquare size={12} />
        {conversando
          ? "Modo conversa ligado — guarda o fio e conduz. Desligar"
          : "Ligar modo conversa (mais capaz, mais caro)"}
      </button>

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
              ) : t.texto !== undefined || t.proposta ? (
                <div className="space-y-2">
                  {t.texto && <Markdown texto={t.texto} />}
                  {t.proposta && (
                    <CartaoDaProposta
                      p={t.proposta}
                      desfecho={t.desfecho}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {t.ferramentas && t.ferramentas.length > 0 && (
                    <p className="text-[11px] text-zinc-600">
                      Consultei: {t.ferramentas.join(" · ")}
                    </p>
                  )}
                </div>
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
          placeholder={contexto?.produto ? "O que falta neste produto?" : "O que eu resolvo primeiro?"}
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
 * A proposta na tela — e o botão que a torna real.
 *
 * Tudo que será gravado está escrito aqui antes de existir botão: qual produto,
 * qual valor, quantas variações. O `resumo` não é decorativo — é o contrato que
 * a pessoa está aceitando, e é o mesmo objeto que vai para `executarProposta`.
 *
 * Quando a unidade foi DEDUZIDA (a frase disse "300" e não "300 g"), isso
 * aparece em destaque. É o único ponto onde o sistema completou o que o cliente
 * não disse, e esconder isso transformaria a confirmação em carimbo.
 */
function CartaoDaProposta({
  p,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  p: Proposta;
  desfecho?: { ok: boolean; mensagem: string; cegoParaAIL: boolean };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  if (p.tipo !== "pronta") {
    return (
      <div className="space-y-1.5">
        <p className="text-sm text-zinc-200">{p.tipo === "ambigua" ? p.mensagem : p.mensagem}</p>
        {p.tipo === "ambigua" && (
          <ul className="space-y-1">
            {p.candidatos.map((c) => (
              <li key={c.id} className="text-xs text-zinc-400">
                · {c.nome}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  // Já decidido: o cartão vira registro. Sem botão, não há como gravar duas
  // vezes clicando rápido.
  if (desfecho) {
    return (
      <div className="space-y-1">
        <p
          className={`flex items-start gap-2 text-sm ${desfecho.ok ? "text-emerald-300" : "text-zinc-400"}`}
        >
          {desfecho.ok ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          )}
          {desfecho.mensagem}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <p className="text-sm text-zinc-200">{p.resumo}</p>
      {p.unidadeDeduzida && (
        <p className="flex items-start gap-1.5 text-xs text-amber-300">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Você não disse a unidade — entendi <strong>{p.valorEscrito}</strong>. Confira antes de
          gravar.
        </p>
      )}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={ocupado}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {ocupado ? "Gravando…" : "Gravar"}
        </button>
        <button
          type="button"
          onClick={aoDescartar}
          disabled={ocupado}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
        >
          Cancelar
        </button>
      </div>
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
