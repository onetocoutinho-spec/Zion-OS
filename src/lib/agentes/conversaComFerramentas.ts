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

/**
 * O mesmo turno, em pedaços.
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
/**
 * Como o modelo escolhe entre falar e chamar ferramenta, NESTE passo.
 *
 * `livre` é o comportamento de sempre (AUTO): ele decide.
 *
 * `obrigado` é a fronteira do INC-003 (ANY + `allowedFunctionNames`): ele NÃO
 * pode responder com texto, e só pode escolher entre as funções listadas. O
 * laço usa isso apenas no primeiro passo — ver `route.ts`.
 */
export type EscolhaDeFerramenta =
  | { modo: "livre" }
  | { modo: "obrigado"; permitidas: readonly string[] };

/** O contrato da API: `ANY` obriga functionCall; `allowedFunctionNames` restringe quais. */
function toolConfig(escolha: EscolhaDeFerramenta) {
  return escolha.modo === "obrigado"
    ? {
        functionCallingConfig: {
          mode: "ANY",
          allowedFunctionNames: [...escolha.permitidas],
        },
      }
    : { functionCallingConfig: { mode: "AUTO" } };
}

export async function pedirTurnoEmFluxo(
  system: string,
  historico: readonly Fala[],
  ferramentas: readonly Ferramenta[],
  aoTexto: (pedaco: string) => void,
  escolha: EscolhaDeFerramenta = { modo: "livre" }
): Promise<TurnoDoModelo> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY ausente.");
  const modelo = process.env.GEMINI_MODELO_CONVERSA ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:streamGenerateContent?alt=sse&key=${key}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: historico.slice(-FALAS_MANTIDAS),
      // As DECLARAÇÕES continuam sendo as 17 em todo passo. O que muda por passo
      // é a ESCOLHA — quais delas o modelo pode selecionar agora, e se ele tem
      // permissão de responder sem selecionar nenhuma.
      tools: [{ functionDeclarations: paraDeclaracoesGemini(ferramentas) }],
      toolConfig: toolConfig(escolha),
      generationConfig: { temperature: 0 },
    }),
  });

  if (!resp.ok || !resp.body) {
    if (resp.status === 503) {
      throw new Error("O Gemini está sobrecarregado no momento (tente de novo em instantes).");
    }
    const detalhe = await resp.text().catch(() => "");
    throw new Error(`Gemini ${resp.status}: ${detalhe.slice(0, 200)}`);
  }

  const leitor = resp.body.getReader();
  const decodificador = new TextDecoder();
  let sobra = "";
  let texto = "";
  const chamadas: { nome: string; args: Record<string, unknown> }[] = [];
  let tokens = 0;

  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    // O corte da rede não respeita linha: o resto de uma linha pela metade fica
    // em `sobra` até o pedaço seguinte completá-la. Sem isso, um JSON partido
    // no meio derrubaria a resposta.
    sobra += decodificador.decode(value, { stream: true });
    const linhas = sobra.split("\n");
    sobra = linhas.pop() ?? "";
    for (const linha of linhas) {
      if (!linha.startsWith("data:")) continue;
      const cru = linha.slice(5).trim();
      if (!cru || cru === "[DONE]") continue;
      let evento: {
        candidates?: { content?: { parts?: Parte[] }; finishReason?: string }[];
        usageMetadata?: { totalTokenCount?: number };
      };
      try {
        evento = JSON.parse(cru);
      } catch {
        continue; // pedaço inválido não derruba o fluxo inteiro
      }
      if (evento.usageMetadata?.totalTokenCount) tokens = evento.usageMetadata.totalTokenCount;
      for (const p of evento.candidates?.[0]?.content?.parts ?? []) {
        if (p.text) {
          texto += p.text;
          aoTexto(p.text);
        }
        if (p.functionCall) {
          chamadas.push({ nome: p.functionCall.name, args: p.functionCall.args ?? {} });
        }
      }
    }
  }

  return { texto: texto.trim(), chamadas, tokens };
}

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
