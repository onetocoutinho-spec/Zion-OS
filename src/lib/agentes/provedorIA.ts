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

export type Provedor = "gemini" | "anthropic";

export interface ChamadaIA {
  system: string;
  mensagem: string;
  /** JSON Schema (estilo Anthropic) da saída estruturada. */
  schema: Record<string, unknown>;
  maxTokens?: number;
}

export interface RespostaIA {
  /** Texto JSON da saída estruturada (já validável com JSON.parse). */
  json: string;
  provedor: Provedor;
  modelo: string;
}

export function provedorConfigurado(): Provedor | null {
  const forcado = process.env.IA_PROVEDOR?.toLowerCase();
  const temGemini = Boolean(process.env.GEMINI_API_KEY);
  const temAnthropic = Boolean(process.env.ANTHROPIC_API_KEY);
  if (forcado === "gemini" && temGemini) return "gemini";
  if (forcado === "anthropic" && temAnthropic) return "anthropic";
  if (temGemini) return "gemini"; // preferência: Gemini (free tier)
  if (temAnthropic) return "anthropic";
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
  return { json: texto, provedor: "gemini", modelo };
}

// ---- Anthropic (Claude) ----

async function chamarAnthropic(c: ChamadaIA): Promise<RespostaIA> {
  const modelo = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY as string });

  const resposta = await client.messages.create({
    model: modelo,
    max_tokens: c.maxTokens ?? 16000,
    thinking: { type: "adaptive" },
    system: c.system,
    output_config: { format: { type: "json_schema", schema: c.schema } },
    messages: [{ role: "user", content: c.mensagem }],
  });

  const texto = resposta.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();

  if (resposta.stop_reason === "refusal" || !texto) {
    throw new Error("O modelo não pôde completar esta solicitação. Ajuste a entrada e tente novamente.");
  }
  return { json: texto, provedor: "anthropic", modelo: resposta.model };
}

/** Chama o provedor configurado e devolve a saída estruturada (JSON). */
export async function chamarIAEstruturada(c: ChamadaIA): Promise<RespostaIA> {
  const p = provedorConfigurado();
  if (p === "gemini") return chamarGemini(c);
  if (p === "anthropic") return chamarAnthropic(c);
  throw new Error("Nenhum provedor de IA configurado.");
}