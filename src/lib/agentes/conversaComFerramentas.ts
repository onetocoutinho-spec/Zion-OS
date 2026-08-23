// Um turno de conversa com ferramentas, contra o modelo configurado.
//
// Fica separado de `provedorIA` de propósito: aquele arquivo faz saída
// estruturada — uma pergunta, uma resposta em JSON. Aqui o modelo pede
// ferramenta, recebe o resultado e continua. São dois contratos diferentes, e
// juntá-los faria o mais simples carregar a complexidade do mais raro.
//
// Este arquivo NÃO executa ferramenta. Ele transporta: manda o histórico,
// devolve o que o modelo pediu. Quem executa é a rota, que conhece o domínio.
// A separação importa porque é ela que impede uma "ferramenta" de nascer aqui,
// longe da invariante que `ferramentasDoAssistente` protege.
//
// ===========================================================================
// ERA GEMINI, DEPOIS CLAUDE. DESDE 23/08/2026, CHATGPT.
// ===========================================================================
//
// O EXP-006 mediu este caminho no `gemini-2.5-flash` e ele funcionava; a
// migração para o Claude veio quando o resto do projeto já falava com ele. Em
// 23/08/2026 o dono decidiu: "quero utilizar somente o ChatGPT". O chat passa
// a ir pela Responses API da OpenAI (`openai.ts`), e o caminho da Anthropic
// fica para quem pedir por nome (`IA_PROVEDOR=anthropic`).
//
// O DIALETO NÃO MUDOU — pela terceira vez. `Fala`/`Parte` atravessa a rede,
// volta no SSE e fica GRAVADO nas conversas do copiloto. A tradução mora em
// `dialetoDaConversa`, pura e testada, agora com as duas saídas.
//
// ===========================================================================
// A FRONTEIRA DO PASSO 0 (INC-003), NOS DOIS PROVEDORES
// ===========================================================================
//
// A OpenAI tem `tool_choice: "required"` (chame ALGUMA ferramenta), a
// Anthropic tem `any`. Nenhuma das duas tem "qualquer uma DESTAS", então a
// restrição do passo 0 é a MESMA nos dois: o passo 0 DECLARA só as leituras e
// obriga a chamar. Uma ferramenta de escrita não está nem declarada no
// primeiro passo, então não há configuração para "cair" e deixá-la
// alcançável. A sentinela do INC-003 guarda o RESULTADO (nenhuma escrita
// alcançável no passo 0), não o mecanismo.

import Anthropic from "@anthropic-ai/sdk";
import { cabeReserva, provedorRoteado, rotaDoModelo } from "./roteamentoDeModelo";
import type { Ferramenta } from "../../modules/assistant/domain/ferramentasDoAssistente";
import {
  entradaDaConversaOpenAI,
  ferramentasDaAnthropic,
  ferramentasDaOpenAI,
  mensagensDaConversa,
} from "./dialetoDaConversa";
import { criarResposta, criarRespostaEmFluxo, esforcoDaOpenAI, type CorpoDaResposta, type RespostaDaOpenAI } from "./openai";

/** Uma fala no histórico, no dialeto do projeto. */
export interface Parte {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: unknown };
}

export interface Fala {
  role: "user" | "model";
  parts: Parte[];
}

export interface TurnoDoModelo {
  /** O que ele quer dizer. Vazio quando só pediu ferramenta. */
  texto: string;
  /** O que ele quer que rode antes de continuar. */
  chamadas: readonly { nome: string; args: Record<string, unknown> }[];
  /**
   * Tokens gastos neste turno — a conta que decide se isto escala.
   *
   * SOMA TUDO, e isso deixou de ser detalhe em 10/08/2026, quando o cache
   * entrou. Na Anthropic, `input_tokens` passa a ser só o RESTO não cacheado:
   * o prefixo lido vai para `cache_read_input_tokens` e o escrito para
   * `cache_creation_input_tokens`. Na OpenAI, `input_tokens` JÁ inclui os
   * cacheados (`cached_tokens` é um detalhe dele, não uma parcela à parte).
   *
   * Somar errado faria o medidor despencar e parecer uma economia de 95%. Não
   * seria economia: seria o medidor tendo parado de ver o que ele mede.
   */
  tokens: number;
  /** Do total acima, quanto veio do cache — mais barato que entrada nova. */
  tokensLidosDoCache: number;
  /** Quanto foi ESCRITO no cache neste turno (só a Anthropic cobra à parte). */
  tokensEscritosNoCache: number;
  /** Rodou no modelo de RESERVA por sobrecarga do principal. Ausente = não. */
  degradado?: boolean;
}

/**
 * O teto de idas e voltas dentro de UMA fala do lojista.
 *
 * Existe porque um modelo pode entrar em laço pedindo a mesma ferramenta. Seis
 * é folgado para o encadeamento mais longo que medimos (achar → checar →
 * propor) e curto o bastante para o custo não fugir sem ninguém ver.
 */
export const MAXIMO_DE_PASSOS = 6;

/**
 * Quantas falas do histórico atravessam.
 *
 * O laço reenvia o histórico inteiro a cada passo, e foi daí que saíram os
 * 5.000 tokens da conversa de três turnos no EXP-006. Cortar o começo é o que
 * mantém o custo linear em vez de quadrático — ao preço de o assistente
 * esquecer o início de uma conversa muito longa, que é o troco certo.
 *
 * O corte é por FALA, então ele pode cair ENTRE uma chamada e a resposta dela.
 * As duas APIs recusam isso; quem limpa é `dialetoDaConversa`.
 */
export const FALAS_MANTIDAS = 24;

/**
 * Como o modelo escolhe entre falar e chamar ferramenta, NESTE passo.
 *
 * `livre` é o comportamento de sempre: ele decide.
 *
 * `obrigado` é a fronteira do INC-003: ele NÃO pode responder com texto, e só
 * alcança as ferramentas listadas. O laço usa isso apenas no primeiro passo —
 * ver `route.ts`.
 */
export type EscolhaDeFerramenta =
  | { modo: "livre" }
  | { modo: "obrigado"; permitidas: readonly string[] };

/** O provedor do chat — a mesma ordem de `provedorConfigurado`. */
export const PROVEDOR_DA_CONVERSA = provedorRoteado();

/**
 * O modelo do chat — da TABELA (`roteamentoDeModelo.ts`), por provedor.
 *
 * OpenAI: `gpt-5` (sobrescrevível por OPENAI_MODELO_CONVERSA). Anthropic:
 * Sonnet 5, e não Opus — aqui o que domina não é raciocínio difícil, é CUSTO
 * POR INTERAÇÃO e latência; o laço reenvia o histórico a cada passo.
 */
export const MODELO_DA_CONVERSA = rotaDoModelo("conversa").principal;

/**
 * Teto de saída do turno. Cobre PENSAMENTO + texto, não só o texto.
 *
 * Folgado de propósito: apertá-lo trunca a resposta no meio, e uma resposta
 * truncada PARECE completa para quem está lendo.
 */
const MAX_TOKENS = 32000;

/**
 * Esforço do raciocínio.
 *
 * `medium`, e não `low`: a trajetória que mais importa aqui (achar → conferir
 * que o alvo é único → propor) é de vários passos, e é exatamente onde esforço
 * baixo arrisca raciocinar de menos. Parâmetro de amostragem (`temperature`)
 * é recusado pelos dois provedores nos modelos com raciocínio.
 */
const ESFORCO = (process.env.IA_ESFORCO_CONVERSA ?? process.env.ANTHROPIC_ESFORCO_CONVERSA ?? "medium") as
  | "low"
  | "medium"
  | "high";

/**
 * O PREFIXO CACHEADO: ferramentas + prompt do sistema.
 *
 * Medido em 10/08/2026: ~6.200 tokens IDÊNTICOS em toda chamada (catálogo de
 * ferramentas + prompt do sistema), reenviados a cada passo. Na Anthropic a
 * marca vai no ÚLTIMO bloco do system, que cobre ferramentas e prompt com um
 * só ponto de corte. Na OpenAI o cache de prefixo é AUTOMÁTICO (sem marca):
 * o que se repete no começo do corpo — `instructions` + `tools` — é o que ele
 * pega, e `cached_tokens` no uso é a prova de que pegou.
 *
 * As mensagens ficam de fora do prefixo nos dois: `historico.slice(-FALAS_MANTIDAS)`
 * é uma janela DESLIZANTE, e o começo dela é justamente o que o cache casa.
 *
 * `ofertaDoPasso` manda só as leituras no passo 0 e todas nos demais —
 * definição de ferramenta diferente = prefixo diferente, então são duas
 * entradas de cache. Quem mexer em `ofertaDoPasso` mexe na chave do cache.
 */
function sistemaCacheado(system: string): Anthropic.TextBlockParam[] {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

function clienteAnthropic(): Anthropic {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error("ANTHROPIC_API_KEY ausente.");
  return new Anthropic({ apiKey: chave });
}

/**
 * As ferramentas deste passo.
 *
 * A restrição do `obrigado` vive na LISTA declarada; a escolha só obriga a
 * chamar. Devolvê-las separadas deixaria possível mandar a lista inteira com
 * "obrigado" — que é justamente a escrita alcançável no passo 0.
 */
function ferramentasDoPasso(ferramentas: readonly Ferramenta[], escolha: EscolhaDeFerramenta): Ferramenta[] {
  if (escolha.modo === "obrigado") {
    const permitidas = new Set(escolha.permitidas);
    return ferramentas.filter((f) => permitidas.has(f.nome));
  }
  return [...ferramentas];
}

function ofertaDoPasso(
  ferramentas: readonly Ferramenta[],
  escolha: EscolhaDeFerramenta
): { tools: Anthropic.Tool[]; tool_choice: Anthropic.ToolChoice } {
  return {
    tools: ferramentasDaAnthropic(ferramentasDoPasso(ferramentas, escolha)),
    tool_choice: { type: escolha.modo === "obrigado" ? "any" : "auto" },
  };
}

// ---- OpenAI ----

function corpoDaOpenAI(
  modelo: string,
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  escolha: EscolhaDeFerramenta
): CorpoDaResposta {
  const esforco = esforcoDaOpenAI(ESFORCO);
  return {
    model: modelo,
    instructions: system,
    input: entradaDaConversaOpenAI(historico.slice(-FALAS_MANTIDAS)),
    tools: ferramentasDaOpenAI(ferramentasDoPasso(ferramentas, escolha)),
    tool_choice: escolha.modo === "obrigado" ? "required" : "auto",
    ...(esforco ? { reasoning: { effort: esforco } } : {}),
    max_output_tokens: MAX_TOKENS,
    store: false,
  };
}

function turnoDaOpenAI(r: RespostaDaOpenAI): TurnoDoModelo {
  if (r.recusa) throw new Error("O modelo não pôde responder a isto. Reformule a pergunta.");
  return {
    texto: r.texto,
    chamadas: r.chamadas.map((c) => ({ nome: c.nome, args: c.args })),
    // Na OpenAI `input_tokens` já inclui os cacheados — não se soma de novo.
    tokens: (r.uso?.entrada ?? 0) + (r.uso?.saida ?? 0),
    tokensLidosDoCache: r.uso?.lidosDoCache ?? 0,
    tokensEscritosNoCache: 0,
  };
}

async function turnoOpenAIEmFluxo(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  aoTexto: (pedaco: string) => void,
  escolha: EscolhaDeFerramenta
): Promise<TurnoDoModelo> {
  const rota = rotaDoModelo("conversa", process.env, "openai");
  // A RESERVA só entra se NADA foi escrito na tela ainda: um pedaço já
  // entregue não pode ser repetido por outro modelo.
  let escreveu = false;
  const aoTextoMarcando = (p: string) => {
    escreveu = true;
    aoTexto(p);
  };
  try {
    return turnoDaOpenAI(await criarRespostaEmFluxo(corpoDaOpenAI(rota.principal, system, historico, ferramentas, escolha), aoTextoMarcando));
  } catch (e) {
    if (escreveu || !rota.reserva || rota.reserva === rota.principal || !cabeReserva(e)) throw e;
    console.warn(`[conversa] ${rota.principal} sobrecarregado; tentando a reserva ${rota.reserva}`);
    const r = await criarRespostaEmFluxo(corpoDaOpenAI(rota.reserva, system, historico, ferramentas, escolha), aoTextoMarcando);
    return { ...turnoDaOpenAI(r), degradado: true };
  }
}

async function turnoOpenAI(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  escolha: EscolhaDeFerramenta
): Promise<TurnoDoModelo> {
  const rota = rotaDoModelo("conversa", process.env, "openai");
  try {
    return turnoDaOpenAI(await criarResposta(corpoDaOpenAI(rota.principal, system, historico, ferramentas, escolha)));
  } catch (e) {
    if (!rota.reserva || rota.reserva === rota.principal || !cabeReserva(e)) throw e;
    console.warn(`[conversa] ${rota.principal} sobrecarregado; tentando a reserva ${rota.reserva}`);
    return { ...turnoDaOpenAI(await criarResposta(corpoDaOpenAI(rota.reserva, system, historico, ferramentas, escolha))), degradado: true };
  }
}

// ---- Anthropic ----

/** O que sai de uma resposta pronta, seja ela transmitida ou não. */
function turnoDaResposta(m: Anthropic.Message): TurnoDoModelo {
  const texto = m.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  const chamadas = m.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
    .map((b) => ({
      nome: b.name,
      args: (b.input ?? {}) as Record<string, unknown>,
    }));
  const u = m.usage;
  const lidos = u?.cache_read_input_tokens ?? 0;
  const escritos = u?.cache_creation_input_tokens ?? 0;
  return {
    texto,
    chamadas,
    // Os QUATRO. `input_tokens` sozinho é o resto não cacheado — ver o campo.
    tokens: (u?.input_tokens ?? 0) + (u?.output_tokens ?? 0) + lidos + escritos,
    tokensLidosDoCache: lidos,
    tokensEscritosNoCache: escritos,
  };
}

/** Erro do provedor traduzido para quem digitou — ou relançado, se não ajuda. */
function erroLegivel(e: unknown): Error {
  if (e instanceof Anthropic.RateLimitError) {
    return new Error("Muitas perguntas ao mesmo tempo. Tente de novo em instantes.");
  }
  if (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503)) {
    return new Error("O Claude está sobrecarregado no momento (tente de novo em instantes).");
  }
  return e instanceof Error ? e : new Error(String(e));
}

async function turnoAnthropicEmFluxo(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  aoTexto: (pedaco: string) => void,
  escolha: EscolhaDeFerramenta
): Promise<TurnoDoModelo> {
  const { tools, tool_choice } = ofertaDoPasso(ferramentas, escolha);
  try {
    const fluxo = clienteAnthropic().messages.stream({
      model: MODELO_DA_CONVERSA,
      max_tokens: MAX_TOKENS,
      system: sistemaCacheado(system),
      messages: mensagensDaConversa(historico.slice(-FALAS_MANTIDAS)),
      tools,
      tool_choice,
      // Pensamento LIGADO, e sem `display`: a lojista lê a resposta, não o
      // caminho até ela. Desligar seria pior que inútil — com pensamento
      // desligado o modelo às vezes ESCREVE a chamada de ferramenta como texto.
      thinking: { type: "adaptive" },
      output_config: { effort: ESFORCO },
    });
    // Só o texto vaza para a tela.
    fluxo.on("text", (pedaco) => aoTexto(pedaco));
    return turnoDaResposta(await fluxo.finalMessage());
  } catch (e) {
    throw erroLegivel(e);
  }
}

async function turnoAnthropic(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  escolha: EscolhaDeFerramenta
): Promise<TurnoDoModelo> {
  const { tools, tool_choice } = ofertaDoPasso(ferramentas, escolha);
  const corpo = {
    model: MODELO_DA_CONVERSA,
    max_tokens: MAX_TOKENS,
    system: sistemaCacheado(system),
    messages: mensagensDaConversa(historico.slice(-FALAS_MANTIDAS)),
    tools,
    tool_choice,
    thinking: { type: "adaptive" as const },
    output_config: { effort: ESFORCO },
  };
  const MAX = 3;
  let ultimo: unknown;
  for (let tentativa = 1; tentativa <= MAX; tentativa++) {
    try {
      return turnoDaResposta(await clienteAnthropic().messages.create(corpo));
    } catch (e) {
      ultimo = e;
      const recuperavel =
        e instanceof Anthropic.RateLimitError ||
        (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503));
      if (!recuperavel || tentativa === MAX) break;
      await new Promise((r) => setTimeout(r, 1200 * tentativa));
    }
  }
  throw erroLegivel(ultimo);
}

// ---- A porta ----

/**
 * O turno, em pedaços.
 *
 * O texto chega enquanto o modelo escreve, em vez de aparecer inteiro depois de
 * cinco segundos parados. `aoTexto` é chamado a cada pedaço; o retorno é o
 * turno completo, porque o laço lá em cima precisa do total para decidir se
 * continua.
 *
 * Sem retentativa depois do primeiro pedaço: recomeçar duplicaria o que o
 * leitor já leu. Quem retenta é a chamada não transmitida.
 */
export async function pedirTurnoEmFluxo(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  aoTexto: (pedaco: string) => void,
  escolha: EscolhaDeFerramenta = { modo: "livre" }
): Promise<TurnoDoModelo> {
  return PROVEDOR_DA_CONVERSA === "openai"
    ? turnoOpenAIEmFluxo(system, historico, ferramentas, aoTexto, escolha)
    : turnoAnthropicEmFluxo(system, historico, ferramentas, aoTexto, escolha);
}

/**
 * O mesmo turno, inteiro.
 *
 * Aqui a retentativa existe: nada foi escrito na tela ainda, então repetir não
 * duplica nada para quem está lendo.
 */
export async function pedirTurno(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  escolha: EscolhaDeFerramenta = { modo: "livre" }
): Promise<TurnoDoModelo> {
  return PROVEDOR_DA_CONVERSA === "openai"
    ? turnoOpenAI(system, historico, ferramentas, escolha)
    : turnoAnthropic(system, historico, ferramentas, escolha);
}
