// Geração/edição de imagem por IA — SOMENTE SERVIDOR.
//
// Usa o modelo de imagem do Gemini (ex.: gemini-2.5-flash-image). Recebe a
// FOTO REAL do produto + uma instrução e devolve a imagem editada (base64).
// A chave GEMINI_API_KEY vive só no servidor.
//
// Filosofia: nunca inventar o produto. Editamos a foto real (fundo/enquadramento)
// ou compomos um infográfico a partir dela — mantendo cor/forma/detalhes fiéis
// (exigência do Mercado Livre).

export interface EntradaImagemIA {
  prompt: string;
  /** Imagem de entrada (base64, sem o prefixo data:). Opcional. */
  imagemBase64?: string;
  mimeType?: string;
}

export interface SaidaImagemIA {
  base64: string;
  mimeType: string;
}

export function imagemIAConfigurada(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export async function gerarImagemGemini(e: EntradaImagemIA): Promise<SaidaImagemIA> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada no servidor.");
  const modelo = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${key}`;

  const parts: Record<string, unknown>[] = [{ text: e.prompt }];
  if (e.imagemBase64) {
    parts.push({
      inline_data: { mime_type: e.mimeType ?? "image/jpeg", data: e.imagemBase64 },
    });
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });

  const data = (await resp.json().catch(() => ({}))) as {
    candidates?: {
      content?: {
        parts?: {
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }[];
      };
      finishReason?: string;
    }[];
    error?: { message?: string; status?: string };
  };

  if (!resp.ok) {
    const msg = data.error?.message ?? `HTTP ${resp.status}`;
    throw new Error(`Gemini imagem ${resp.status}: ${msg}`.slice(0, 400));
  }

  const cand = data.candidates?.[0];
  if (cand?.finishReason === "SAFETY") {
    throw new Error("A geração foi bloqueada por política de conteúdo. Tente outra foto/instrução.");
  }
  const partesOut = cand?.content?.parts ?? [];
  for (const p of partesOut) {
    const inl = p.inlineData ?? p.inline_data;
    const dados = inl?.data;
    if (dados) {
      const mime =
        (p.inlineData?.mimeType ?? p.inline_data?.mime_type) || "image/png";
      return { base64: dados, mimeType: mime };
    }
  }
  throw new Error("O modelo não retornou uma imagem. Tente novamente com outra foto.");
}
