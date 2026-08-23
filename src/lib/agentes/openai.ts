// O cliente HTTP da OpenAI (Responses API). Server-only.
//
// ===========================================================================
// POR QUE EXISTE, E POR QUE SEM SDK
// ===========================================================================
//
// Decisão do dono em 23/08/2026: o projeto passa a falar SÓ com o ChatGPT
// (OpenAI) — classificação, chat com ferramentas, esteira, título/descrição,
// catálogo em PDF e imagem. Até então o trabalho pesado era do Claude e o
// chat ia pelo SDK da Anthropic; `provedorImagem` já falava com a OpenAI por
// `fetch` cru, com o formato MEDIDO em vez de lembrado.
//
// Este arquivo segue o mesmo caminho: `fetch` + o formato da Responses API,
// sem um SDK a mais na árvore. Dois motivos: (1) é o padrão que a OpenAI já
// tem neste repositório, e (2) a superfície usada é pequena — criar resposta,
// com e sem fluxo, e subir arquivo. Um SDK inteiro por três chamadas é peso
// sem lastro.
//
// ===========================================================================
// O QUE VAI E O QUE VOLTA (o contrato que o resto do projeto enxerga)
// ===========================================================================
//
// Entra `CorpoDaResposta` — o corpo da Responses API, já no formato dela.
// Quem monta o corpo é quem conhece o domínio (`provedorIA` para saída
// estruturada, `conversaComFerramentas` para o laço com ferramentas). Aqui só
// transporte, erro legível e uso de tokens.
//
// Sai `RespostaDaOpenAI`: o texto, as chamadas de função, o uso e o motivo de
// parada. O `output` cru da API não vaza para fora deste arquivo — o dia em que
// o formato mudar, muda aqui.

export const URL_DA_OPENAI = "https://api.openai.com/v1";

/** O esforço que a Responses API aceita. `xhigh`/`max` do projeto viram `high`. */
export type EsforcoOpenAI = "minimal" | "low" | "medium" | "high";

export function esforcoDaOpenAI(e: string | undefined): EsforcoOpenAI | undefined {
  if (!e) return undefined;
  if (e === "xhigh" || e === "max") return "high";
  if (e === "minimal" || e === "low" || e === "medium" || e === "high") return e;
  return undefined;
}

/** Um item de entrada da Responses API. Só os que o projeto usa. */
export type ItemDeEntrada =
  | { role: "user" | "assistant"; content: ConteudoDeEntrada[] }
  | { type: "function_call"; call_id: string; name: string; arguments: string }
  | { type: "function_call_output"; call_id: string; output: string };

export type ConteudoDeEntrada =
  | { type: "input_text"; text: string }
  | { type: "output_text"; text: string }
  | { type: "input_image"; image_url: string; detail?: "auto" | "low" | "high" }
  | { type: "input_file"; file_id: string }
  | { type: "input_file"; filename: string; file_data: string };

export interface FerramentaDaOpenAI {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  strict: false;
}

export type EscolhaDaOpenAI = "auto" | "required" | "none" | { type: "function"; name: string };

export interface CorpoDaResposta {
  model: string;
  instructions?: string;
  input: ItemDeEntrada[];
  tools?: FerramentaDaOpenAI[];
  tool_choice?: EscolhaDaOpenAI;
  text?: { format: { type: "json_schema"; name: string; schema: Record<string, unknown>; strict: boolean } };
  reasoning?: { effort: EsforcoOpenAI };
  max_output_tokens?: number;
  /** Não guardar a conversa do lado da OpenAI — o histórico é nosso. */
  store?: boolean;
}

export interface UsoDaOpenAI {
  entrada: number;
  saida: number;
  total: number;
  /** Do que entrou, quanto veio do cache automático de prefixo. */
  lidosDoCache: number;
}

export interface RespostaDaOpenAI {
  id: string;
  modelo: string;
  texto: string;
  chamadas: { id: string; nome: string; args: Record<string, unknown> }[];
  uso: UsoDaOpenAI | null;
  /** `completed`, `incomplete` (estourou teto), `failed`. */
  status: string;
  /** A API recusou (conteúdo). `texto` vem vazio. */
  recusa: string | null;
  /** Por que ficou incompleta — `max_output_tokens`, `content_filter`… */
  motivoIncompleta: string | null;
}

/** Erro com o status HTTP preservado — `cabeReserva` decide por ele. */
export class ErroDaOpenAI extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly codigo?: string
  ) {
    super(message);
    this.name = "ErroDaOpenAI";
  }
}

function chave(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new ErroDaOpenAI("OPENAI_API_KEY não configurada no servidor.", 0, "sem_chave");
  return k;
}

/** Transitório: vale tentar de novo ou cair para a reserva. */
export function erroTransitorio(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 529;
}

/** Erro da API traduzido para quem digitou. Nunca carrega a chave. */
export function erroLegivelDaOpenAI(e: unknown): Error {
  if (e instanceof ErroDaOpenAI) {
    if (e.status === 401) return new ErroDaOpenAI("OPENAI_API_KEY inválida. Confira a chave no servidor.", 401, e.codigo);
    if (e.status === 429 && /quota|billing|insufficient/i.test(e.message))
      return new ErroDaOpenAI("A conta da OpenAI está sem crédito. Confira o faturamento.", 429, e.codigo);
    if (e.status === 429) return new ErroDaOpenAI("Muitas perguntas ao mesmo tempo. Tente de novo em instantes.", 429, e.codigo);
    if (e.status === 503 || e.status === 529 || e.status === 500 || e.status === 502)
      return new ErroDaOpenAI("A OpenAI está sobrecarregada no momento (tente de novo em instantes).", e.status, e.codigo);
    return e;
  }
  return e instanceof Error ? e : new Error(String(e));
}

/** O corpo de erro da API, ou um genérico com o status. */
async function lancarErroHttp(resp: Response): Promise<never> {
  const dados = (await resp.json().catch(() => ({}))) as { error?: { message?: string; code?: string; type?: string } };
  const msg = dados.error?.message ?? `HTTP ${resp.status}`;
  throw new ErroDaOpenAI(`OpenAI ${resp.status}: ${msg}`.slice(0, 400), resp.status, dados.error?.code ?? dados.error?.type);
}

// ---- O formato cru que a API devolve (só o que lemos) ----

interface RespostaCrua {
  id?: string;
  model?: string;
  status?: string;
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string; code?: string } | null;
  output?: ItemDeSaida[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
}

type ItemDeSaida =
  | { type: "message"; content?: ({ type: "output_text"; text: string } | { type: "refusal"; refusal: string })[] }
  | { type: "function_call"; call_id: string; name: string; arguments?: string }
  | { type: string };

function argumentos(s: string | undefined): Record<string, unknown> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A leitura do `output` cru — o único lugar que conhece esse formato. */
export function lerResposta(r: RespostaCrua): RespostaDaOpenAI {
  const textos: string[] = [];
  const chamadas: RespostaDaOpenAI["chamadas"] = [];
  let recusa: string | null = null;
  for (const item of r.output ?? []) {
    if (item.type === "message") {
      for (const c of (item as { content?: { type: string; text?: string; refusal?: string }[] }).content ?? []) {
        if (c.type === "output_text" && typeof c.text === "string") textos.push(c.text);
        else if (c.type === "refusal") recusa = c.refusal ?? "recusado";
      }
    } else if (item.type === "function_call") {
      const f = item as { call_id: string; name: string; arguments?: string };
      chamadas.push({ id: f.call_id, nome: f.name, args: argumentos(f.arguments) });
    }
  }
  const u = r.usage;
  const uso: UsoDaOpenAI | null =
    typeof u?.input_tokens === "number"
      ? {
          entrada: u.input_tokens,
          saida: u.output_tokens ?? 0,
          total: u.total_tokens ?? u.input_tokens + (u.output_tokens ?? 0),
          lidosDoCache: u.input_tokens_details?.cached_tokens ?? 0,
        }
      : null;
  return {
    id: r.id ?? "",
    modelo: r.model ?? "",
    texto: textos.join("").trim(),
    chamadas,
    uso,
    status: r.status ?? "completed",
    recusa,
    motivoIncompleta: r.status === "incomplete" ? (r.incomplete_details?.reason ?? "desconhecido") : null,
  };
}

/**
 * Uma resposta, inteira.
 *
 * Retentativa só em transitório (429/5xx), até três vezes — nada foi
 * entregue a ninguém ainda, então repetir não duplica nada.
 */
export async function criarResposta(corpo: CorpoDaResposta, opcoes: { tentativas?: number; timeoutMs?: number } = {}): Promise<RespostaDaOpenAI> {
  const MAX = opcoes.tentativas ?? 3;
  let ultimo: unknown;
  for (let tentativa = 1; tentativa <= MAX; tentativa++) {
    try {
      const resp = await fetch(`${URL_DA_OPENAI}/responses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${chave()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ store: false, ...corpo, stream: false }),
        signal: AbortSignal.timeout(opcoes.timeoutMs ?? 180_000),
      });
      if (!resp.ok) await lancarErroHttp(resp);
      const crua = (await resp.json()) as RespostaCrua;
      if (crua.status === "failed") {
        throw new ErroDaOpenAI(`OpenAI: ${crua.error?.message ?? "a resposta falhou"}`, 500, crua.error?.code);
      }
      return lerResposta(crua);
    } catch (e) {
      ultimo = e;
      if (!erroTransitorio(e) || tentativa === MAX) break;
      await new Promise((r) => setTimeout(r, 1200 * tentativa));
    }
  }
  throw erroLegivelDaOpenAI(ultimo);
}

/**
 * A mesma resposta, em fluxo: `aoTexto` recebe cada pedaço de texto enquanto o
 * modelo escreve. Sem retentativa — um pedaço já entregue não pode ser repetido.
 *
 * Só o TEXTO vaza: raciocínio e argumentos de função chegando pela metade não
 * são coisas para alguém ler.
 */
export async function criarRespostaEmFluxo(
  corpo: CorpoDaResposta,
  aoTexto: (pedaco: string) => void,
  opcoes: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<RespostaDaOpenAI> {
  let resp: Response;
  try {
    resp = await fetch(`${URL_DA_OPENAI}/responses`, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ store: false, ...corpo, stream: true }),
      signal: opcoes.signal ?? AbortSignal.timeout(opcoes.timeoutMs ?? 180_000),
    });
  } catch (e) {
    throw erroLegivelDaOpenAI(e);
  }
  if (!resp.ok) {
    try {
      await lancarErroHttp(resp);
    } catch (e) {
      throw erroLegivelDaOpenAI(e);
    }
  }
  if (!resp.body) throw new Error("A OpenAI não devolveu corpo.");

  let final: RespostaCrua | null = null;
  let erro: ErroDaOpenAI | null = null;
  for await (const evento of eventosSse(resp.body)) {
    if (evento.type === "response.output_text.delta" && typeof evento.delta === "string") {
      aoTexto(evento.delta);
    } else if (evento.type === "response.completed" || evento.type === "response.incomplete") {
      final = (evento.response as RespostaCrua) ?? null;
    } else if (evento.type === "response.failed") {
      const r = evento.response as RespostaCrua | undefined;
      erro = new ErroDaOpenAI(`OpenAI: ${r?.error?.message ?? "a resposta falhou"}`, 500, r?.error?.code);
    } else if (evento.type === "error") {
      const e = evento as { message?: string; code?: string };
      erro = new ErroDaOpenAI(`OpenAI: ${e.message ?? "erro no fluxo"}`, 500, e.code);
    }
  }
  if (erro) throw erroLegivelDaOpenAI(erro);
  if (!final) throw new Error("O fluxo da OpenAI terminou sem a resposta final.");
  return lerResposta(final);
}

/** Os eventos de um corpo SSE, um JSON por evento. */
export async function* eventosSse(corpo: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const leitor = corpo.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await leitor.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let corte: number;
      while ((corte = buffer.indexOf("\n\n")) >= 0) {
        const bloco = buffer.slice(0, corte);
        buffer = buffer.slice(corte + 2);
        const dados = bloco
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("\n");
        if (!dados || dados === "[DONE]") continue;
        try {
          yield JSON.parse(dados) as Record<string, unknown>;
        } catch {
          // Linha partida ou ruído: ignora, o evento final ainda vem.
        }
      }
    }
  } finally {
    leitor.releaseLock();
  }
}

/**
 * Sobe um arquivo para a Files API e devolve o id — para `input_file`.
 * `purpose: "user_data"` é o de documento que o modelo vai LER.
 */
export async function enviarArquivo(arquivo: File): Promise<string> {
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", arquivo, arquivo.name || "documento.pdf");
  const resp = await fetch(`${URL_DA_OPENAI}/files`, {
    method: "POST",
    headers: { Authorization: `Bearer ${chave()}` },
    body: form,
    signal: AbortSignal.timeout(600_000),
  });
  if (!resp.ok) {
    try {
      await lancarErroHttp(resp);
    } catch (e) {
      throw erroLegivelDaOpenAI(e);
    }
  }
  const dados = (await resp.json()) as { id?: string };
  if (!dados.id) throw new Error("A OpenAI não devolveu o id do arquivo.");
  return dados.id;
}
