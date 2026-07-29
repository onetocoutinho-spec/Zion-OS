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
import { conversar, confirmarProposta } from "@/lib/services/conversaDoAssistente";
import { Markdown } from "@/components/client-portal/Markdown";
import type { PropostaDeAnuncio } from "@/modules/assistant/domain/propostaDeAnuncio";
import type { Fala } from "@/lib/agentes/conversaComFerramentas";
import type { RespostaDaConversa } from "@/lib/services/conversaDoAssistente";
import {
  desfechoDaConfirmacao,
  estadoDoCartao,
} from "@/modules/assistant/domain/cartaoDoLote";
import {
  desfechoDaCriacao,
  escreverGrade,
  estadoDoCartaoDeCadastro,
  type CadastroNaTela,
  type DesfechoDoCadastro,
} from "@/modules/assistant/domain/cartaoDoCadastro";

type EscopoNaTela = NonNullable<RespostaDaConversa["escopo"]>;
import {
  chaveDaConversa,
  lerGuardada,
  paraGuardar,
} from "@/modules/assistant/domain/conversaGuardada";
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
  /**
   * O ID da proposta PERSISTIDA. Sem ele não existe botão.
   *
   * O objeto `proposta` acima desenha o cartão; este id é o que AUTORIZA. Uma
   * proposta que não chegou ao banco não pode ser confirmada — e mostrar botão
   * para ela seria oferecer uma ação que o servidor vai recusar.
   */
  propostaId?: string;
  /**
   * O escopo de um LOTE. Presente só quando a proposta atinge vários alvos.
   *
   * As contagens vêm do SERVIDOR, nunca do modelo: o que está sendo aprovado é
   * justamente a quantidade, e um número que o modelo escreveu é um número que
   * ele pode ter errado.
   */
  escopo?: EscopoNaTela;
  /**
   * O que aconteceu depois de confirmar. Trava o cartão contra duplo clique.
   *
   * `cegoParaAIL` é opcional porque um turno RETOMADO do disco não sabe — e
   * `false` ali seria uma afirmação falsa sobre uma gravação que a AIL pode
   * muito bem não ter visto.
   */
  desfecho?: {
    ok: boolean;
    mensagem: string;
    cegoParaAIL?: boolean;
    /** O servidor recusou porque o catálogo mudou. Nada foi criado. */
    stale?: boolean;
    /** O produto que nasceu, quando a proposta era de cadastro. */
    produtoId?: string;
  };
  /**
   * O cadastro em conversa — estado do Draft PERSISTIDO, vindo do servidor.
   *
   * Fica no turno como a proposta: se a pessoa perguntar outra coisa antes de
   * confirmar, o cartão continua no lugar dele em vez de flutuar apontando para
   * um cadastro que já saiu de vista.
   */
  cadastro?: CadastroNaTela;
  /**
   * Uma proposta de GERAR ANÚNCIO, ainda não disparada.
   *
   * Separada da de gravação porque o botão faz outra coisa: em vez de escrever
   * um campo, leva para a esteira e a dispara. São dois verbos diferentes e
   * dois riscos diferentes — misturá-los num cartão só faria um deles mentir.
   */
  propostaDeAnuncio?: PropostaDeAnuncio;
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
  alturaCheia = false,
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
  /**
   * No painel e na página: ocupa a altura toda e a conversa rola dentro dela.
   *
   * Embutido numa página, o chat precisa de teto (`max-h-96`) para não empurrar
   * o resto. Num painel dedicado, esse mesmo teto é o que faz a resposta rolar
   * numa janelinha com espaço vazio embaixo.
   */
  alturaCheia?: boolean;
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

  /**
   * Retoma a conversa guardada — uma vez, na montagem.
   *
   * `retomou` existe porque sem ele um recarregamento das consultas
   * reescreveria os turnos por cima do que a pessoa acabou de dizer. É a mesma
   * trava da retomada de produto na esteira, pelo mesmo motivo.
   */
  const [retomou, setRetomou] = useState(false);
  useEffect(() => {
    if (retomou) return;
    setRetomou(true);
    try {
      const g = lerGuardada(localStorage.getItem(chaveDaConversa(clienteId)));
      if (!g || g.turnos.length === 0) return;
      setTurnos(g.turnos.map((t) => ({ ...t })));
      setFalas(g.falas as Fala[]);
      // Só faz sentido retomar no modo que produziu aquele fio.
      setConversando(true);
    } catch {
      // storage indisponível (aba anônima, cota): a conversa começa do zero
    }
  }, [retomou, clienteId]);

  // Grava a cada mudança. A PROPOSTA não atravessa — ver `conversaGuardada`.
  useEffect(() => {
    if (!retomou || turnos.length === 0) return;
    try {
      localStorage.setItem(
        chaveDaConversa(clienteId),
        JSON.stringify(paraGuardar(turnos, falas))
      );
    } catch {
      // cota estourada: a conversa continua na tela, só não sobrevive ao F5
    }
  }, [turnos, falas, clienteId, retomou]);

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
                    ...(r.proposta && r.propostaId
                      ? { proposta: r.proposta, propostaId: r.propostaId }
                      : {}),
                    ...(r.escopo && r.propostaId
                      ? { escopo: r.escopo, propostaId: r.propostaId }
                      : {}),
                    ...(r.propostaDeAnuncio
                      ? { propostaDeAnuncio: r.propostaDeAnuncio }
                      : {}),
                    // O cadastro traz o próprio `propostaId` quando há
                    // autorização montada. Ele NÃO passa pelo campo genérico:
                    // os dois cartões oferecem verbos diferentes, e um id só
                    // faria o botão errado aparecer.
                    ...(r.cadastro ? { cadastro: r.cadastro } : {}),
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
      // O cadastro carrega o próprio id: os dois cartões podem coexistir num
      // turno, e confundir os dois confirmaria a proposta errada.
      const id = alvo?.cadastro?.propostaId ?? alvo?.propostaId;
      const ehCadastro = Boolean(alvo?.cadastro?.propostaId);
      // Sem ID persistido não há o que confirmar. A checagem repete a do
      // render de propósito: um clique que escapou (teclado, corrida de
      // estado) não pode virar uma chamada sem autorização.
      if (!id || alvo.desfecho || ocupado) return;
      setOcupado(true);
      try {
        // O SERVIDOR decide. Ele carrega a proposta do banco, confere o tenant
        // contra a sessão, revalida as precondições contra o estado de agora,
        // reserva a execução de forma atômica e audita. A tela só mostra.
        const r = await confirmarProposta(id);
        setTurnos((t) =>
          t.map((turno, i) =>
            i === indice
              ? {
                  ...turno,
                  desfecho: ehCadastro ? desfechoDaCriacao(r) : desfechoDaConfirmacao(r),
                }
              : turno
          )
        );
        if (r.ok) aoGravar?.();
      } catch (e) {
        const erro = e instanceof Error ? e.message : "Não consegui confirmar.";
        setTurnos((t) =>
          t.map((turno, i) =>
            i === indice ? { ...turno, desfecho: { ok: false, mensagem: erro } } : turno
          )
        );
      } finally {
        setOcupado(false);
      }
    },
    [turnos, ocupado, aoGravar]
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
    <div
      className={
        alturaCheia
          ? "flex h-full flex-col p-4"
          : "rounded-xl border border-white/10 bg-zinc-900/40 p-4"
      }
    >
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

      {/* Em altura cheia o container existe SEMPRE, mesmo vazio: e ele que
          come o espaco e empurra a barra de digitar para o pe. Sem isso a
          barra fica colada no topo com o vazio embaixo, que e o oposto do
          que a mao espera num chat. */}
      {(alturaCheia || turnos.length > 0) && (
        <div
          className={`mt-4 space-y-4 overflow-y-auto pr-1 ${
            alturaCheia ? "min-h-0 flex-1" : "max-h-96"
          }`}
        >
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
              ) : t.texto !== undefined || t.proposta || t.cadastro ? (
                <div className="space-y-2">
                  {t.texto && <Markdown texto={t.texto} />}
                  {t.cadastro && (
                    <CartaoDoCadastro
                      c={t.cadastro}
                      desfecho={t.desfecho}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {t.propostaDeAnuncio && <CartaoDeAnuncio p={t.propostaDeAnuncio} />}
                  {t.escopo && t.propostaId && (
                    <CartaoDoLote
                      e={t.escopo}
                      desfecho={t.desfecho}
                      ocupado={ocupado}
                      aoConfirmar={() => void confirmar(i)}
                      aoDescartar={() => descartar(i)}
                    />
                  )}
                  {t.proposta && t.propostaId && (
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
        className={`flex gap-2 ${alturaCheia ? "mt-3 shrink-0" : "mt-4"}`}
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
 * O cadastro em conversa — o que já se sabe, a grade, e o que ainda falta.
 *
 * TUDO AQUI VEM DO SERVIDOR. O status, a contagem de variantes, a lista do que
 * falta e a existência do botão saem do Draft persistido e da Proposal — nunca
 * do texto que o modelo escreveu. Um cartão que acreditasse na frase do modelo
 * ofereceria "Criar produto" para um cadastro que o servidor recusaria.
 *
 * Os estados vêm de `estadoDoCartaoDeCadastro`, que é domínio provado: tela e
 * teste calculando o mesmo em dois lugares divergem no primeiro ajuste.
 */
function CartaoDoCadastro({
  c,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  c: CadastroNaTela;
  desfecho?: DesfechoDoCadastro & { cegoParaAIL?: boolean };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  const e = estadoDoCartaoDeCadastro(c, desfecho);

  if (e.estado === "concluido") {
    return (
      <div className="space-y-1.5">
        <p
          className={`flex items-start gap-2 text-sm ${e.ok ? "text-emerald-300" : "text-amber-300"}`}
        >
          {e.ok ? (
            <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          ) : (
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          )}
          {e.mensagem}
        </p>
        {e.produtoId && (
          <Link
            href={`/cliente/anunciar?produto=${encodeURIComponent(e.produtoId)}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            Abrir o produto <ArrowRight size={12} />
          </Link>
        )}
      </div>
    );
  }

  if (e.estado === "cancelado") {
    return <p className="text-sm text-zinc-400">{e.mensagem}</p>;
  }

  if (e.estado === "escolha") {
    return (
      <div className="space-y-1.5 rounded-lg border border-white/10 bg-black/20 p-3">
        <p className="text-sm text-zinc-200">Você tem mais de um cadastro em andamento:</p>
        <ol className="space-y-1">
          {e.opcoes.map((o) => (
            <li key={o.id} className="text-xs text-zinc-400">
              {o.ordem}. {o.rotulo}
            </li>
          ))}
        </ol>
        <p className="text-[11px] text-zinc-600">
          Diga qual — eu não escolho por você.
        </p>
      </div>
    );
  }

  const linhasDaGrade = escreverGrade(c.variantes);

  return (
    <div className="space-y-2.5 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-zinc-500">
          Cadastro em andamento
        </p>
        <p className="text-sm font-medium text-zinc-100">{e.titulo}</p>
      </div>

      {c.jaSei.length > 0 && (
        <dl className="space-y-0.5 text-xs">
          {c.jaSei.map((f) => (
            <div key={f.campo} className="flex gap-2">
              <dt className="w-32 shrink-0 text-zinc-500">{f.campo}</dt>
              <dd className="text-zinc-200">
                {f.valor}
                {/* A PROCEDÊNCIA aparece quando não foi o lojista que disse. O
                    que ele informou não precisa de selo; o que veio de outro
                    lugar precisa, e esconder isso transformaria a confirmação
                    em carimbo. */}
                {f.procedencia !== "informado" && (
                  <span className="text-amber-400/70"> ·{f.procedencia}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {c.variantes.total > 0 && (
        <div className="text-xs">
          <p className="text-zinc-500">
            Variantes: <span className="text-zinc-200">{c.variantes.total}</span>
            {c.variantes.semSku > 0 && (
              <span className="text-amber-300"> · {c.variantes.semSku} sem SKU</span>
            )}
          </p>
          <ul className="mt-0.5 space-y-0.5">
            {linhasDaGrade.map((linha) => (
              <li key={linha} className="text-zinc-400">
                {linha}
              </li>
            ))}
          </ul>
        </div>
      )}

      {c.conflitos.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-400/25 bg-amber-500/[0.04] p-2">
          {c.conflitos.map((k) => (
            <p key={k.campo} className="flex items-start gap-1.5 text-xs text-amber-300">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              Você me disse dois valores de {k.campo}: {k.valorAtual} e {k.valorNovo}. Qual vale?
            </p>
          ))}
        </div>
      )}

      {/* POSSÍVEL duplicidade — nunca identidade. Casamento exato não fecha
          nada nesta base: 117 SKUs e 112 EANs se repetem. O cartão mostra e
          pergunta; ele não funde e não bloqueia. */}
      {c.candidatos && c.candidatos.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-400/25 bg-amber-500/[0.04] p-2">
          <p className="flex items-start gap-1.5 text-xs text-amber-300">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            {c.candidatosMensagem ??
              "Encontrei produtos que podem corresponder a este cadastro."}
          </p>
          <ul className="space-y-0.5">
            {c.candidatos.map((k, indice) => (
              <li key={k.produtoId} className="text-[11px] text-zinc-400">
                {indice + 1}.{" "}
                <Link
                  href={`/cliente/anunciar?produto=${encodeURIComponent(k.produtoId)}`}
                  className="text-violet-400 hover:text-violet-300"
                >
                  {[k.marca, k.nome].filter(Boolean).join(" ")}
                </Link>
                {k.referencia && <span className="text-zinc-600"> · ref {k.referencia}</span>}
                {k.sku && <span className="text-zinc-600"> · SKU {k.sku}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {e.estado === "coletando" && e.falta.length > 0 && (
        <div className="text-xs">
          <p className="text-zinc-500">Ainda preciso de:</p>
          <ul className="mt-0.5 space-y-0.5">
            {e.falta.map((f) => (
              <li key={f.o_que} className="flex items-start gap-1.5">
                <span className={f.bloqueia ? "text-amber-400" : "text-zinc-600"}>·</span>
                <span>
                  <span className={f.bloqueia ? "text-zinc-200" : "text-zinc-400"}>{f.o_que}</span>
                  <span className="text-zinc-600"> — {f.porque}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(e.estado === "pronto" || e.estado === "proposta") && e.resumo && (
        <p className="rounded-lg border border-white/5 bg-black/20 p-2 text-sm text-zinc-200">
          {e.resumo}
        </p>
      )}

      {/* O BOTÃO SÓ EXISTE NO ESTADO `proposta` — quer dizer: com uma Proposal
          persistida, do tenant certo, sobre um cadastro que `validarRascunho`
          aprovou. Nos outros estados não há o que confirmar, e um botão ali
          seria oferecer uma ação que o servidor vai recusar. */}
      {e.estado === "proposta" && (
        <div className="flex gap-2 pt-0.5">
          <button
            type="button"
            onClick={aoConfirmar}
            disabled={ocupado}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
          >
            {ocupado ? "Criando…" : e.rotuloBotao}
          </button>
          <button
            type="button"
            onClick={aoDescartar}
            disabled={ocupado}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200 disabled:opacity-40"
          >
            Agora não
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * A proposta de gerar anúncio — e o botão que leva para a esteira.
 *
 * O botão NAVEGA em vez de rodar aqui. A esteira leva de dois a três minutos,
 * tem barra de progresso, salva as entregas parciais e sabe se recuperar de uma
 * aba fechada. Rodá-la dentro de um painel de chat seria uma segunda cópia
 * dessa máquina — pior, e sem nada disso.
 *
 * Quando falta dado, NÃO existe botão. A pessoa lê o que falta e resolve; um
 * botão ali gastaria três minutos para devolver um anúncio com pendência.
 */
function CartaoDeAnuncio({ p }: { p: PropostaDeAnuncio }) {
  if (p.tipo === "sem_alvo") {
    return <p className="text-sm text-zinc-300">{p.mensagem}</p>;
  }

  if (p.tipo === "falta_dado") {
    return (
      <div className="space-y-1.5 rounded-lg border border-amber-400/20 bg-amber-500/[0.04] p-3">
        <p className="flex items-start gap-2 text-sm text-zinc-200">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-400" />
          {p.mensagem}
        </p>
        <Link
          href={`/cliente/anunciar?produto=${encodeURIComponent(p.produtoId)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-violet-400 hover:text-violet-300"
        >
          Abrir o produto <ArrowRight size={12} />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <p className="text-sm text-zinc-200">{p.resumo}</p>
      {/* Os atributos com a ORIGEM de cada um: o que veio do cadastro e o que
          foi lido do nome. Apresentar dedução como dado seria o começo do
          mesmo problema que a esteira ja teve. */}
      <ul className="flex flex-wrap gap-1.5">
        {p.atributos.map((a) => (
          <li
            key={a.id}
            className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-zinc-400"
            title={a.origem === "nome" ? "lido do nome do produto" : "do cadastro"}
          >
            {a.nome}: <span className="text-zinc-300">{a.valor}</span>
            {a.origem === "nome" && <span className="text-amber-400/70"> ·lido do nome</span>}
          </li>
        ))}
      </ul>
      <Link
        href={`/cliente/anunciar?produto=${encodeURIComponent(p.produtoId)}&gerar=1`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500"
      >
        <Sparkles size={13} /> {p.refazendo ? "Refazer o anúncio" : "Gerar o anúncio"}
      </Link>
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
/**
 * O cartão de um LOTE — o que a pessoa lê antes de mexer em dezenas de linhas.
 *
 * Todas as contagens vêm do SERVIDOR. O cartão não pergunta ao modelo quantos
 * serão alterados: é justamente a quantidade que está sendo aprovada, e um
 * número escrito pelo modelo é um número que ele pode ter errado.
 *
 * A unidade é KG porque é o que o domínio guarda (`peso: number // kg`, usado
 * no frete). A conversa aceita "420 g" e a Proposal carrega gramas, mas o que
 * aparece aqui é o que vai para o banco — e não existe "peso embalado" nem
 * "peso líquido" no modelo, então o rótulo é só "Peso".
 *
 * Três estados, e nenhum deles deixa o botão ativo por engano:
 *   pendente  → mostra o escopo e oferece aplicar
 *   concluído → vira registro, sem botão
 *   obsoleto  → diz que nada foi alterado, sem botão
 */
function CartaoDoLote({
  e,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  e: EscopoNaTela;
  desfecho?: { ok: boolean; mensagem: string; cegoParaAIL?: boolean };
  ocupado: boolean;
  aoConfirmar: () => void;
  aoDescartar: () => void;
}) {
  // Já decidido: o cartão vira registro. Sem botão, não há como gravar duas
  // vezes — e "já foi feito" chega aqui como SUCESSO, porque foi.
  if (desfecho) {
    return (
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
    );
  }

  // As decisões vêm do domínio provado (`cartaoDoLote`), não daqui: tela e
  // teste calculando o mesmo em dois lugares divergem no primeiro ajuste.
  const c = estadoDoCartao(e);
  if (c.estado !== "pendente") return null;

  return (
    <div className="space-y-2.5 rounded-lg border border-violet-400/25 bg-violet-500/[0.04] p-3">
      <p className="text-[11px] uppercase tracking-wider text-zinc-500">
        Alterar {e.campo}
      </p>

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-zinc-500">Novo valor</dt>
          <dd className="font-medium text-zinc-100">
            {c.valorEscrito}
          </dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-32 shrink-0 text-zinc-500">Afeta</dt>
          <dd className="text-zinc-200">
            {c.alvo}
            {e.campo === "peso" && e.produtosAfetados > 1 && (
              <span className="text-zinc-500"> · {e.produtosAfetados} produtos</span>
            )}
          </dd>
        </div>
        {e.naoAlterados > 0 && (
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-zinc-500">Já têm {e.campo}</dt>
            <dd className="text-amber-300">
              {e.naoAlterados} — não {e.naoAlterados > 1 ? "serão alterados" : "será alterado"}
            </dd>
          </div>
        )}
      </dl>

      {e.amostra.length > 0 && (
        // AMOSTRA, não a lista: com centenas de alvos isto viraria uma parede.
        // Os ids vivem na Proposal, no servidor.
        <p className="text-xs text-zinc-500">
          {e.amostra.slice(0, 3).join(" · ")}
          {e.produtosAfetados > 3 && ` e mais ${e.produtosAfetados - 3}`}
        </p>
      )}

      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={aoConfirmar}
          disabled={ocupado}
          className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-500 disabled:opacity-40"
        >
          {ocupado ? "Aplicando…" : c.rotuloBotao}
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

function CartaoDaProposta({
  p,
  desfecho,
  ocupado,
  aoConfirmar,
  aoDescartar,
}: {
  p: Proposta;
  desfecho?: { ok: boolean; mensagem: string; cegoParaAIL?: boolean };
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
