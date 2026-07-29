// Um turno de conversa com ferramentas, contra o Gemini.
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
// Medido no EXP-006 (gemini-2.5-flash, 8 conversas, temperatura 0): 8/8, zero
// escrita indevida, zero número inventado, ~1.800 tokens por conversa.

import type { Ferramenta } from "../../modules/assistant/domain/ferramentasDoAssistente";

/** Uma fala no histórico, no dialeto do Gemini. */
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
  /** Tokens gastos neste turno — a conta que decide se isto escala. */
  tokens: number;
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
 */
export const FALAS_MANTIDAS = 24;

export function paraDeclaracoesGemini(fs: readonly Ferramenta[]) {
  return fs.map((f) => ({
    name: f.nome,
    description: f.descricao,
    parameters: f.parametros,
  }));
}

export async function pedirTurno(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[]
): Promise<TurnoDoModelo> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente.");
  const modelo = process.env.GEMINI_MODELO_CONVERSA ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`;

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: historico.slice(-FALAS_MANTIDAS),
    tools: [{ functionDeclarations: paraDeclaracoesGemini(ferramentas) }],
    // Temperatura 0: a mesma frase deve levar à mesma ferramenta. Criatividade
    // aqui não é qualidade, é variação em cima de decisão que mexe em dado.
    generationConfig: { temperature: 0 },
  };

  let resp!: Response;
  let data!: {
    candidates?: { content?: { parts?: Parte[] }; finishReason?: string }[];
    usageMetadata?: { totalTokenCount?: number };
    error?: { message?: string };
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
    await new Promise((r) => setTimeout(r, 1200 * tentativa));
  }

  if (!resp.ok) {
    // O 503 aconteceu de verdade durante os testes de hoje. A mensagem dele
    // atravessa porque "sobrecarregado, tente de novo" é acionável para quem
    // digitou — diferente de um erro de schema, que não é.
    if (resp.status === 503) {
      throw new Error("O Gemini está sobrecarregado no momento (tente de novo em instantes).");
    }
    throw new Error(`Gemini ${resp.status}: ${data.error?.message ?? "falha"}`.slice(0, 300));
  }

  const cand = data.candidates?.[0];
  if (cand?.finishReason === "SAFETY") {
    throw new Error("O Gemini bloqueou a resposta por política de conteúdo.");
  }
  const partes = cand?.content?.parts ?? [];
  return {
    texto: partes
      .map((p) => p.text ?? "")
      .join("")
      .trim(),
    chamadas: partes
      .filter((p) => p.functionCall)
      .map((p) => ({ nome: p.functionCall!.name, args: p.functionCall!.args ?? {} })),
    tokens: data.usageMetadata?.totalTokenCount ?? 0,
  };
}
