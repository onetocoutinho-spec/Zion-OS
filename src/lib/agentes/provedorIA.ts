// Camada de provedor de IA (server-only).
//
// O Zion OS fala com Gemini (Google) OU Claude (Anthropic) por trás da mesma
// interface. A escolha é por variável de ambiente:
//   - GEMINI_API_KEY  → usa Gemini (tem plano gratuito no Google AI Studio)
//   - ANTHROPIC_API_KEY → usa Claude
//   - IA_PROVEDOR=gemini|anthropic força um deles (se a chave existir)
// Preferência automática: Gemini (custo zero para começar).
//
// Nunca importe este módulo no cliente — as chaves ficam só no servidor.

import Anthropic from "@anthropic-ai/sdk";
import { cronometro, registrarExecucaoIA, type OrigemDaExecucao } from "@/lib/services/execucoesDeIA";

export type Provedor = "gemini" | "anthropic";

/**
 * Um documento ou imagem que o modelo vai LER.
 *
 * ===========================================================================
 * POR QUE ISTO PASSOU A EXISTIR
 * ===========================================================================
 *
 * Até 05/08/2026 esta interface carregava `mensagem: string` e nada mais. Os
 * seis pontos que chamam a IA passavam por aqui, então o sistema inteiro só
 * sabia raciocinar sobre TEXTO — e todo input de arquivo do app aceitava
 * `.csv/.xlsx` ou `image/*`.
 *
 * O modelo lê PDF nativamente desde sempre. O que faltava era fio. Ficou
 * visível quando apareceu um cliente cujo catálogo é um PDF de 90 páginas: não
 * havia por onde ele entrar, e a causa não era capacidade do modelo — era uma
 * assinatura de função.
 *
 * O mesmo buraco explica o infográfico genérico de 04/08: "o prompt recebe só
 * texto livre" não era um defeito do infográfico, era ESTE defeito aparecendo
 * num lugar.
 *
 * ===========================================================================
 * QUAL VARIANTE USAR
 * ===========================================================================
 *
 * A requisição inteira tem teto de **32 MB**, e é sobre ela que `base64` esbarra
 * — não sobre o arquivo. Um catálogo de verdade passa disso fácil (o primeiro
 * que chegou tem 272,6 MB). Para esses existe a Files API, com teto de 500 MB:
 * sobe uma vez com `enviarPdfParaIA`, referencia pelo id em toda chamada.
 */
export type AnexoIA =
  /** PDF pequeno, embutido na requisição. Conta para o teto de 32 MB. */
  | { tipo: "pdf"; base64: string }
  /** PDF já enviado pela Files API. É o caminho dos catálogos grandes. */
  | { tipo: "pdf-arquivo"; fileId: string }
  /** Imagem para o modelo LER. Gerar/editar imagem é outro módulo (`provedorImagem`). */
  | { tipo: "imagem"; base64: string; mimeType: string };

export interface ChamadaIA {
  system: string;
  mensagem: string;
  /**
   * Documentos e imagens que entram junto da pergunta.
   *
   * Vão ANTES do texto no conteúdo da mensagem, que é a ordem que a
   * documentação da API pede — o modelo lê o material e depois a instrução
   * sobre o que fazer com ele.
   */
  anexos?: AnexoIA[];
  /** JSON Schema (estilo Anthropic) da saída estruturada. */
  schema: Record<string, unknown>;
  /**
   * Quanto o modelo deve raciocinar nesta chamada. Omitido = o padrão da API.
   *
   * ===========================================================================
   * POR QUE ISTO PRECISOU EXISTIR
   * ===========================================================================
   *
   * TODA chamada estruturada do projeto rodava no padrão, que é esforço ALTO.
   * Para a extração de um catálogo de 90 páginas isso é o certo. Para
   * CLASSIFICAR UMA FRASE — "o lojista está perguntando sobre peso ou sobre
   * preço?" — é raciocínio de sobra, e o custo não é só dinheiro: em 05/08/2026
   * a classificação estourou os 30s da rota e a Vercel devolveu uma página HTML
   * de erro, que o cliente tentou ler como JSON. O lojista viu
   * `Unexpected token '<', "<!DOCTYPE "...` no lugar da resposta.
   *
   * Ou seja: esforço alto numa tarefa trivial não sai mais lento — sai QUEBRADO,
   * e quebrado de um jeito que não diz o que aconteceu.
   */
  esforco?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  /**
   * QUEM está pagando e POR QUÊ — para a linha em `ia_execucoes` (067).
   *
   * Opcional porque nem todo chamador tem sessão (o worker do cron, por
   * exemplo). Quem tem, passa: sem rastro a chamada acontece, mas não entra
   * na conta de "quanto custa um usuário por mês".
   */
  rastro?: RastroDaExecucao;
}

export interface RastroDaExecucao {
  origem: OrigemDaExecucao;
  clienteId: string | null;
  usuarioId: string | null;
  conversaId?: string | null;
}

export interface RespostaIA {
  /** Texto JSON da saída estruturada (já validável com JSON.parse). */
  json: string;
  provedor: Provedor;
  modelo: string;
  /**
   * O que a chamada CUSTOU, na palavra do provedor.
   *
   * `null` quando ele não informou — e `null` não vira zero. Uma execução sem
   * uso conhecido some da média se for contada como grátis, e aí a conta de
   * custo mente para baixo, que é a direção pior.
   *
   * Existe porque em 03/08/2026 a pergunta "quanto custa um dia de operação"
   * só tinha resposta pela metade: a SAÍDA dava para medir no banco (4.198
   * bytes por anúncio), a ENTRADA era estimativa minha. Estimativa de custo é
   * a mesma classe de suposição-vestida-de-fato que a AUD-001 caçou.
   */
  uso: UsoDeTokens | null;
}

export interface UsoDeTokens {
  entrada: number;
  saida: number;
  total: number;
  modelo: string;
  provedor: Provedor;
}

export function provedorConfigurado(): Provedor | null {
  const forcado = process.env.IA_PROVEDOR?.toLowerCase();
  const temGemini = Boolean(process.env.GEMINI_API_KEY);
  const temAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  if (forcado === "gemini" && temGemini) return "gemini";
  if (forcado === "anthropic" && temAnthropic) return "anthropic";
  // A preferência era Gemini, com o comentário "free tier — custo zero para
  // começar". O efeito, que ninguém escolheu explicitamente: qual inteligência
  // atende a lojista passou a ser decidido pela PRESENÇA DE UMA VARIÁVEL DE
  // AMBIENTE, em silêncio, e o caminho Anthropic — Opus 5, thinking adaptativo,
  // saída validada por schema — só era alcançado quando a chave do Gemini
  // faltava.
  //
  // Decisão do dono em 05/08/2026: o trabalho pesado é do Claude. Quem quiser o
  // Gemini pede por nome (`IA_PROVEDOR=gemini`), que é o que uma escolha
  // deliberada parece.
  //
  // Só o Anthropic lê anexo (ver `chamarGemini`), então esta ordem também é o
  // que faz a fronteira do documento existir na prática.
  if (temAnthropic) return "anthropic";
  if (temGemini) return "gemini";
  return null;
}

// ---- Conversão de schema para o formato do Gemini (OpenAPI subset) ----

const TIPO_GEMINI: Record<string, string> = {
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  array: "ARRAY",
  object: "OBJECT",
};

export function paraSchemaGemini(s: unknown): unknown {
  if (!s || typeof s !== "object") return s;
  const o = s as Record<string, unknown>;
  const tipoBruto = Array.isArray(o.type)
    ? (o.type as string[]).find((t) => t !== "null")
    : (o.type as string | undefined);
  const out: Record<string, unknown> = {};
  if (tipoBruto) out.type = TIPO_GEMINI[tipoBruto] ?? "STRING";
  if (o.description) out.description = o.description;
  if (o.enum) out.enum = o.enum;
  if (o.items) out.items = paraSchemaGemini(o.items);
  if (o.properties) {
    const props: Record<string, unknown> = {};
    for (const k of Object.keys(o.properties as Record<string, unknown>)) {
      props[k] = paraSchemaGemini((o.properties as Record<string, unknown>)[k]);
    }
    out.properties = props;
    if (o.required) out.required = o.required;
  }
  // `additionalProperties` é descartado de propósito (o Gemini não aceita).
  return out;
}

// ---- Gemini ----

async function chamarGemini(c: ChamadaIA): Promise<RespostaIA> {
  // Este caminho não monta anexo, e recusar é a única resposta honesta.
  //
  // Não é que o Gemini não saiba receber arquivo — `provedorImagem` manda
  // `inline_data` para ele todo dia. É que ESTE caminho não foi construído nem
  // medido, e a alternativa a lançar seria montar o corpo sem os anexos: o
  // modelo responderia normalmente, sobre um documento que nunca viu, e a
  // resposta pareceria boa. Falha em silêncio é a família de defeito que este
  // repositório já perseguiu duas vezes (ver `escritasQueFalhamEmSilencio`).
  if (c.anexos?.length) {
    throw new Error(
      "Anexos (PDF/imagem) só funcionam com o Claude. Configure ANTHROPIC_API_KEY " +
        "ou remova IA_PROVEDOR=gemini."
    );
  }
  const key = process.env.GEMINI_API_KEY as string;
  const modelo = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`;

  const body = {
    systemInstruction: { parts: [{ text: c.system }] },
    contents: [{ role: "user", parts: [{ text: c.mensagem }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: paraSchemaGemini(c.schema),
      maxOutputTokens: Math.min(c.maxTokens ?? 8192, 8192),
      temperature: 0.6,
    },
  };

  // Retry em 503 (modelo sobrecarregado) e 429 (rate limit) — transitórios.
  let resp!: Response;
  let data!: {
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    // O uso SEMPRE veio nesta resposta e o tipo não o declarava, então ele era
    // descartado sem ninguém notar — mesmo formato do defeito que jogava fora
    // `sub_status` e a associação foto-cor.
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
    error?: { message?: string; status?: string };
  };
  const MAX = 3;
  for (let tentativa = 1; tentativa <= MAX; tentativa++) {
    resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    data = (await resp.json().catch(() => ({}))) as typeof data;
    if (resp.ok || (resp.status !== 503 && resp.status !== 429) || tentativa === MAX) break;
    await new Promise((r) => setTimeout(r, 1200 * tentativa)); // 1.2s, 2.4s
  }

  if (!resp.ok) {
    const msg = data.error?.message ?? `HTTP ${resp.status}`;
    const st = data.error?.status ?? "";
    if (resp.status === 400 && /API key|API_KEY/i.test(msg))
      throw new Error("GEMINI_API_KEY inválida. Confira a chave no .env.local.");
    if (resp.status === 503)
      throw new Error("O Gemini está sobrecarregado no momento (tente de novo em instantes).");
    throw new Error(`Gemini ${resp.status} ${st}: ${msg}`.slice(0, 400));
  }

  const cand = data.candidates?.[0];
  const texto = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
  if (cand?.finishReason === "SAFETY") {
    throw new Error("O Gemini bloqueou a resposta por política de conteúdo. Ajuste a entrada.");
  }
  if (!texto) throw new Error("O Gemini não retornou conteúdo. Tente novamente.");
  const u = data.usageMetadata;
  return {
    json: texto,
    provedor: "gemini",
    modelo,
    uso:
      typeof u?.totalTokenCount === "number"
        ? {
            entrada: u.promptTokenCount ?? 0,
            saida: u.candidatesTokenCount ?? 0,
            total: u.totalTokenCount,
            modelo,
            provedor: "gemini",
          }
        : null,
  };
}

// ---- Anthropic (Claude) ----

/** Os formatos de imagem que a API aceita. Fora desta lista, recusamos. */
const MIMES_IMAGEM = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type MimeImagem = (typeof MIMES_IMAGEM)[number];

function ehMimeDeImagem(m: string): m is MimeImagem {
  return (MIMES_IMAGEM as readonly string[]).includes(m);
}

/**
 * O conteúdo da mensagem: **anexos primeiro, texto depois**.
 *
 * A ordem não é estética. É o que a documentação da API pede, e faz sentido do
 * lado do modelo: ele lê o material e só então a instrução sobre o que fazer
 * com ele. Invertido, a instrução fala de algo que ainda não apareceu.
 */
export function blocosDaMensagem(c: ChamadaIA): Anthropic.Beta.BetaContentBlockParam[] {
  const blocos: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const a of c.anexos ?? []) {
    if (a.tipo === "pdf") {
      blocos.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: a.base64 },
      });
    } else if (a.tipo === "pdf-arquivo") {
      blocos.push({ type: "document", source: { type: "file", file_id: a.fileId } });
    } else {
      // Recusar o formato desconhecido em vez de empurrar como JPEG: a API
      // recusaria de qualquer jeito, e o erro dela não diria qual anexo era.
      if (!ehMimeDeImagem(a.mimeType)) {
        throw new Error(
          `Formato de imagem não suportado: ${a.mimeType}. Aceitos: ${MIMES_IMAGEM.join(", ")}.`
        );
      }
      blocos.push({
        type: "image",
        source: { type: "base64", media_type: a.mimeType, data: a.base64 },
      });
    }
  }
  blocos.push({ type: "text", text: c.mensagem });
  return blocos;
}

/**
 * Sobe um PDF para a Files API e devolve o id para usar em `AnexoIA`.
 *
 * É o caminho dos catálogos de verdade. O teto de 32 MB que derruba o base64 é
 * da REQUISIÇÃO; aqui o teto é do arquivo, e são 500 MB. O primeiro catálogo que
 * chegou tem 272,6 MB em 90 páginas — passa longe do primeiro limite e cabe
 * neste com folga.
 *
 * Sobe UMA vez. O id serve para todas as chamadas seguintes sobre o mesmo
 * documento, o que importa quando a extração precisar de mais de uma passada.
 */
export async function enviarPdfParaIA(arquivo: File): Promise<string> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  const client = new Anthropic({ apiKey: chave });
  const enviado = await client.beta.files.upload({
    file: arquivo,
    betas: ["files-api-2025-04-14"],
  });
  return enviado.id;
}

/**
 * Quanto uma chamada vai custar de ENTRADA, sem fazê-la.
 *
 * Existe porque o primeiro catálogo que chegou tem 272,6 MB em 90 páginas — uns
 * 3 MB por página, resolução de impressão. Isso não estoura limite nenhum
 * (a Files API vai até 500 MB), mas 90 páginas densas de imagem podem custar
 * muito, e descobrir o custo TENTANDO é descobrir depois de pagar.
 *
 * O endpoint de contagem não gera nada: devolve o número de tokens de entrada
 * do mesmo corpo que a chamada real mandaria. É a medição antes da construção
 * que o plano pedia, e ela não depende de ninguém segurar o arquivo.
 *
 * Só Anthropic — é o único caminho que lê documento.
 */
export async function contarTokensDaChamada(c: ChamadaIA): Promise<number> {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) throw new Error("ANTHROPIC_API_KEY não configurada no servidor.");
  const client = new Anthropic({ apiKey: chave });
  const usaFilesApi = (c.anexos ?? []).some((a) => a.tipo === "pdf-arquivo");
  const r = await client.beta.messages.countTokens({
    model: process.env.ANTHROPIC_MODEL ?? "claude-opus-5",
    system: c.system,
    messages: [{ role: "user", content: blocosDaMensagem(c) }],
    ...(usaFilesApi ? { betas: ["files-api-2025-04-14"] } : {}),
  });
  return r.input_tokens;
}

async function chamarAnthropic(c: ChamadaIA): Promise<RespostaIA> {
  // claude-opus-5 é o Opus atual. O padrão daqui estava em `claude-opus-4-8`,
  // que é a geração anterior — padrão de modelo envelhece em silêncio, porque
  // nada quebra: o modelo antigo responde normalmente e ninguém percebe que
  // parou de ser o melhor disponível.
  const modelo = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY as string });

  // O header beta da Files API vai na chamada de mensagem também, não só no
  // upload — e só quando existe anexo que veio de lá. Mandar sempre ligaria uma
  // beta em todas as chamadas do sistema por causa de uma minoria delas.
  //
  // A chamada é sempre pelo namespace `beta` porque o tipo de bloco de lá é
  // superconjunto do comum (ele conhece `source: { type: "file" }`, o comum
  // não). Sem `betas`, nenhum header extra é enviado e a requisição é a mesma
  // de antes — um caminho só, em vez de dois iguais e um `as` para calar o
  // compilador sobre a diferença que importa.
  const usaFilesApi = (c.anexos ?? []).some((a) => a.tipo === "pdf-arquivo");
  const resposta = await client.beta.messages.create({
    model: modelo,
    max_tokens: c.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    system: c.system,
    output_config: {
      format: { type: "json_schema", schema: c.schema },
      ...(c.esforco ? { effort: c.esforco } : {}),
    },
    messages: [{ role: "user", content: blocosDaMensagem(c) }],
    ...(usaFilesApi ? { betas: ["files-api-2025-04-14"] } : {}),
  });

  const texto = resposta.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  if (resposta.stop_reason === "refusal" || !texto) {
    throw new Error("O modelo não pôde completar esta solicitação. Ajuste a entrada e tente novamente.");
  }
  const uA = (resposta as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  return {
    json: texto,
    provedor: "anthropic",
    modelo: resposta.model,
    uso:
      typeof uA?.input_tokens === "number"
        ? {
            entrada: uA.input_tokens,
            saida: uA.output_tokens ?? 0,
            total: uA.input_tokens + (uA.output_tokens ?? 0),
            modelo: resposta.model,
            provedor: "anthropic",
          }
        : null,
  };
}

/** Chama o provedor configurado e devolve a saída estruturada (JSON). */
export async function chamarIAEstruturada(c: ChamadaIA): Promise<RespostaIA> {
  const p = provedorConfigurado();
  if (p !== "gemini" && p !== "anthropic") throw new Error("Nenhum provedor de IA configurado.");
  const relogio = cronometro();
  try {
    const r = p === "gemini" ? await chamarGemini(c) : await chamarAnthropic(c);
    if (c.rastro) {
      await registrarExecucaoIA({
        ...c.rastro,
        provedor: r.provedor,
        modelo: r.modelo,
        tokens: r.uso ? { entrada: r.uso.entrada, saida: r.uso.saida, total: r.uso.total } : null,
        ms: relogio.ms(),
        status: "ok",
      });
    }
    return r;
  } catch (e) {
    // A chamada que FALHOU é a que mais importa na conta — e era a que sumia.
    if (c.rastro) {
      await registrarExecucaoIA({
        ...c.rastro,
        provedor: p,
        modelo: null,
        ms: relogio.ms(),
        status: "erro",
        erro: e instanceof Error ? e.message : "desconhecido",
      });
    }
    throw e;
  }
}