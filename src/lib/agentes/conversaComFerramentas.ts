// Um turno de conversa com ferramentas, contra o Claude.
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
// ERA GEMINI. POR QUE MUDOU, E O QUE MUDOU DE VERDADE
// ===========================================================================
//
// O EXP-006 mediu este caminho no `gemini-2.5-flash` (8 conversas, 8/8, zero
// escrita indevida) e ele funcionava. O que não funcionava era o sistema em
// volta: desde a inversão do provedor, TODO o resto do projeto fala com o
// Claude, e só o chat — a IA com quem a lojista de fato conversa — continuava
// preso a outro provedor, com chave e modelo próprios. Pior: a rota barrava em
// `GEMINI_API_KEY`, então num servidor só com a chave da Anthropic o chat
// respondia "nenhum provedor configurado" com o Claude funcionando ao lado.
//
// O DIALETO NÃO MUDOU. `Fala`/`Parte` atravessa a rede, volta no SSE e fica
// GRAVADO nas conversas do copiloto — trocá-lo quebraria toda conversa salva.
// Ele virou o dialeto neutro do projeto, e a tradução mora em
// `dialetoDaConversa`, pura e testada.
//
// ===========================================================================
// A ÚNICA COISA QUE A MIGRAÇÃO NÃO CONSEGUIU PRESERVAR
// ===========================================================================
//
// O Gemini aceitava `ANY` + `allowedFunctionNames`: "chame uma ferramenta, e
// só pode ser uma DESTAS". A Anthropic não tem esse meio-termo — `tool_choice`
// é `auto`, `any` (QUALQUER ferramenta) ou `tool` (UMA nomeada).
//
// Então a restrição do passo 0 mudou de lugar: em vez de declarar as 17 e
// restringir a escolha, o passo 0 DECLARA só as leituras e usa `any`. O
// efeito é o mesmo — o modelo é obrigado a chamar, e só alcança leitura — e a
// garantia fica mais forte, não mais fraca: uma ferramenta de escrita não está
// nem declarada no primeiro passo, então não há configuração para "cair" e
// deixá-la alcançável.
//
// A sentinela do INC-003 foi reescrita junto, e passou a guardar o RESULTADO
// (nenhuma escrita alcançável no passo 0) em vez do MECANISMO.

import Anthropic from "@anthropic-ai/sdk";
import type { Ferramenta } from "../../modules/assistant/domain/ferramentasDoAssistente";
import { ferramentasDaAnthropic, mensagensDaConversa } from "./dialetoDaConversa";

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
   * SOMA OS QUATRO CAMPOS, e isso deixou de ser detalhe em 10/08/2026, quando o
   * cache entrou. Com cache, `input_tokens` passa a ser só o RESTO não
   * cacheado: o prefixo lido vai para `cache_read_input_tokens` e o escrito
   * para `cache_creation_input_tokens`.
   *
   * Somar só entrada + saída faria o medidor despencar de ~37 mil para ~2 mil
   * e parecer uma economia de 95%. Não seria economia: seria o medidor tendo
   * parado de ver a maior parte do que ele mede.
   *
   * Este número existe porque a AUD-001 achou o custo documentado em dois
   * lugares com valores diferentes e nenhum conferível. Quebrá-lo ao ligar o
   * cache seria desfazer exatamente aquele conserto.
   */
  tokens: number;
  /** Do total acima, quanto veio do cache — a 0,1× do preço de entrada. */
  tokensLidosDoCache: number;
  /** Quanto foi ESCRITO no cache neste turno, a 1,25×. Zero é o caso comum. */
  tokensEscritosNoCache: number;
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
 * Isso o Gemini engolia e a Anthropic recusa; quem limpa é `dialetoDaConversa`.
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

/**
 * O modelo do chat.
 *
 * Sonnet 5, e não Opus: aqui o que domina não é raciocínio difícil, é CUSTO POR
 * INTERAÇÃO e latência. O laço reenvia o histórico a cada passo, até seis por
 * fala do lojista, e cada fala é uma pessoa esperando na tela. O Sonnet 5 fica
 * perto do Opus em trabalho com ferramenta por ~40% menos por token.
 *
 * O resto do projeto (esteira, extração do catálogo) continua no Opus, onde a
 * chamada é rara e o erro entra no cadastro em escala.
 */
export const MODELO_DA_CONVERSA = process.env.ANTHROPIC_MODELO_CONVERSA ?? "claude-sonnet-5";

/**
 * Teto de saída do turno. Cobre PENSAMENTO + texto, não só o texto.
 *
 * O caminho Gemini não tinha teto nenhum. Este é folgado de propósito: apertá-lo
 * trunca a resposta no meio, e uma resposta truncada PARECE completa para quem
 * está lendo.
 */
const MAX_TOKENS = 32000;

/**
 * Esforço do raciocínio.
 *
 * Havia `temperature: 0` aqui, com o motivo certo: "a mesma frase deve levar à
 * mesma ferramenta". Parâmetro de amostragem é recusado com 400 no Opus 5, e a
 * substituição para determinismo é esforço BAIXO com prompt apertado — o prompt
 * deste chat já é longo e específico.
 *
 * `medium`, e não `low`: a trajetória que mais importa aqui (achar → conferir
 * que o alvo é único → propor) é de vários passos, e é exatamente onde esforço
 * baixo arrisca raciocinar de menos.
 */
const ESFORCO = (process.env.ANTHROPIC_ESFORCO_CONVERSA ?? "medium") as
  | "low"
  | "medium"
  | "high";

/**
 * O PREFIXO CACHEADO: ferramentas + prompt do sistema.
 *
 * ===========================================================================
 * O QUE FOI MEDIDO EM 10/08/2026
 * ===========================================================================
 *
 *   catálogo de ferramentas   ~4.240 tokens
 *   prompt do sistema         ~1.977 tokens
 *                             ─────────────
 *                             ~6.200 tokens, IDÊNTICOS em toda chamada
 *
 * O laço reenvia isso a cada passo, até seis por fala. Eram ~37.200 tokens de
 * entrada por pergunta, todos a preço cheio, e nada disso mudava entre um passo
 * e o seguinte.
 *
 * ===========================================================================
 * POR QUE A MARCA VAI NO SYSTEM E NÃO NAS FERRAMENTAS
 * ===========================================================================
 *
 * A ordem de renderização é `tools` → `system` → `messages`. Uma marca no
 * ÚLTIMO bloco do system cobre os dois — ferramentas e prompt — com um só
 * ponto de corte. Marcar as ferramentas separadamente gastaria um dos quatro
 * pontos disponíveis para cachear um pedaço que este já cobre.
 *
 * ===========================================================================
 * POR QUE AS MENSAGENS FICAM DE FORA
 * ===========================================================================
 *
 * `historico.slice(-FALAS_MANTIDAS)` é uma janela DESLIZANTE: quando ela anda,
 * as falas mais antigas somem do começo, e o começo é justamente o que o cache
 * casa. Uma marca ali escreveria entrada nova toda vez que a janela andasse —
 * pagando 1,25× repetidamente para ler 0,1× quase nunca.
 *
 * ===========================================================================
 * DOIS PREFIXOS, NÃO UM
 * ===========================================================================
 *
 * `ofertaDoPasso` manda 11 ferramentas no passo 0 (o `obrigado`) e 18 nos
 * demais. Definição de ferramenta diferente = prefixo diferente, então são
 * duas entradas de cache. As duas são estáveis e se repetem em toda fala, então
 * as duas valem — mas quem mexer em `ofertaDoPasso` precisa saber que está
 * mexendo na chave do cache.
 *
 * `tool_choice` mudar de `any` para `auto` NÃO invalida nada: só a definição
 * das ferramentas e o modelo forçam reconstrução.
 */
function sistemaCacheado(system: string): Anthropic.TextBlockParam[] {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

function cliente(): Anthropic {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error("ANTHROPIC_API_KEY ausente.");
  return new Anthropic({ apiKey: chave });
}

/**
 * As ferramentas E a escolha deste passo.
 *
 * Os dois saem juntos porque no `obrigado` eles são a MESMA decisão: a
 * restrição vive na lista declarada, e `any` só obriga a chamar. Devolvê-los
 * separados deixaria possível mandar a lista inteira com `any` — que é
 * justamente a escrita alcançável no passo 0.
 */
function ofertaDoPasso(
  ferramentas: readonly Ferramenta[],
  escolha: EscolhaDeFerramenta
): { tools: Anthropic.Tool[]; tool_choice: Anthropic.ToolChoice } {
  if (escolha.modo === "obrigado") {
    const permitidas = new Set(escolha.permitidas);
    return {
      tools: ferramentasDaAnthropic(ferramentas.filter((f) => permitidas.has(f.nome))),
      tool_choice: { type: "any" },
    };
  }
  return {
    tools: ferramentasDaAnthropic(ferramentas),
    tool_choice: { type: "auto" },
  };
}

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

/**
 * O turno, em pedaços.
 *
 * O texto chega enquanto o modelo escreve, em vez de aparecer inteiro depois de
 * cinco segundos parados. É a diferença mais sentida entre "uma caixa que
 * responde" e "uma conversa" — e é só isso: a resposta é a mesma.
 *
 * `aoTexto` é chamado a cada pedaço. O retorno é o turno completo, igual ao de
 * `pedirTurno`, porque o laço lá em cima precisa do total para decidir se
 * continua.
 *
 * Sem retentativa: um 503 no meio de um fluxo já entregou pedaço de texto ao
 * leitor, e recomeçar duplicaria o que ele já leu. Quem retenta é a chamada não
 * transmitida, que ainda não escreveu nada na tela.
 */
export async function pedirTurnoEmFluxo(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  aoTexto: (pedaco: string) => void,
  escolha: EscolhaDeFerramenta = { modo: "livre" }
): Promise<TurnoDoModelo> {
  const { tools, tool_choice } = ofertaDoPasso(ferramentas, escolha);
  try {
    const fluxo = cliente().messages.stream({
      model: MODELO_DA_CONVERSA,
      max_tokens: MAX_TOKENS,
      system: sistemaCacheado(system),
      messages: mensagensDaConversa(historico.slice(-FALAS_MANTIDAS)),
      tools,
      tool_choice,
      // Pensamento LIGADO, e sem `display`. O padrão do Opus 5 não devolve o
      // texto do raciocínio, que é o que se quer aqui: a lojista lê a resposta,
      // não o caminho até ela. Desligar seria pior que inútil — com pensamento
      // desligado o modelo às vezes ESCREVE a chamada de ferramenta como texto,
      // e aí a ferramenta simplesmente não roda, sem erro nenhum.
      thinking: { type: "adaptive" },
      output_config: { effort: ESFORCO },
    });

    // Só o texto vaza para a tela. Bloco de pensamento e argumento de
    // ferramenta chegando pela metade não são coisas para alguém ler.
    fluxo.on("text", (pedaco) => aoTexto(pedaco));

    return turnoDaResposta(await fluxo.finalMessage());
  } catch (e) {
    throw erroLegivel(e);
  }
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
      return turnoDaResposta(await cliente().messages.create(corpo));
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
