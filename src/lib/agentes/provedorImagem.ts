// Geração/edição de imagem por IA — SOMENTE SERVIDOR.
//
// ===========================================================================
// O QUE ESTE MÓDULO NUNCA FAZ: INVENTAR O PRODUTO
// ===========================================================================
//
// Ele recebe a FOTO REAL do produto + uma instrução e devolve a imagem editada.
// Editamos fundo e enquadramento, ou compomos um infográfico A PARTIR dela —
// mantendo cor, forma e detalhe fiéis.
//
// Isso não é preferência estética. É a diferença entre um anúncio e uma
// infração DOMAIN, e esta conta já tem 110. Por isso a exigência sobre qualquer
// provedor que entre aqui é a mesma: precisa saber EDITAR uma imagem de
// entrada, não só gerar do zero.
//
// ===========================================================================
// DOIS PROVEDORES, E POR QUE A PREFERÊNCIA AINDA NÃO VIROU
// ===========================================================================
//
// A decisão do dono (05/08/2026) é substituir o Gemini pela OpenAI aqui — é o
// único lugar do projeto que ainda não fala com o Claude, e o Claude não gera
// imagem. A estrutura para isso é o que existe abaixo.
//
// O CORPO DA CHAMADA À OPENAI NÃO ESTÁ ESCRITO, e isso é deliberado. A rede
// deste ambiente não alcança `api.openai.com` nem a doc dela (medido: http=000
// nos dois), então o formato da requisição não pôde ser verificado. Escrever de
// memória foi exatamente o que produziu os schemas em `type: "OBJECT"` que
// quase foram para produção no mesmo dia — o dialeto errado passa por typecheck,
// por teste, e só a API reclama.
//
// Então `gerarImagemOpenAI` LANÇA, com o motivo. Ela não cai para o Gemini em
// silêncio: cair de volta é como um provedor que "funciona" enquanto entrega
// outra coisa, e é o defeito que `provedorIA` documenta na recusa de anexo.
//
// E a PREFERÊNCIA CONTINUA NO GEMINI enquanto o caminho não existir. Só
// `IA_IMAGEM_PROVEDOR=openai` alcança a OpenAI, de propósito: a inversão do
// provedor de texto ensinou que "qual inteligência atende a lojista decidido
// pela presença de uma variável de ambiente" é um efeito que ninguém escolhe.
// Colocar a chave da OpenAI no servidor não pode quebrar a geração que funciona.
//
// QUANDO O FORMATO CHEGAR: preencher `gerarImagemOpenAI`, acrescentar "openai"
// a `IMPLEMENTADOS`, e mover a linha de preferência. São três lugares, todos
// marcados.

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

export type ProvedorDeImagem = "openai" | "gemini";

/**
 * Quais caminhos existem de verdade.
 *
 * É DADO, não um `if` espalhado: enquanto "openai" está fora daqui, nenhum
 * lugar do sistema pode achar que ele funciona. Acrescentá-lo é o segundo dos
 * três passos quando a chamada estiver escrita.
 */
const IMPLEMENTADOS: ReadonlySet<ProvedorDeImagem> = new Set<ProvedorDeImagem>(["gemini"]);

function temChave(p: ProvedorDeImagem): boolean {
  return p === "openai"
    ? Boolean(process.env.OPENAI_API_KEY)
    : Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Qual provedor de imagem está configurado. `null` quando nenhum.
 *
 * A ordem NÃO é "o mais novo primeiro". É: o que foi pedido explicitamente,
 * senão o que funciona. Ver o cabeçalho — trocar esta ordem antes de a chamada
 * da OpenAI existir quebraria a geração de imagem de quem está no ar.
 */
export function provedorDeImagemConfigurado(): ProvedorDeImagem | null {
  const forcado = process.env.IA_IMAGEM_PROVEDOR?.toLowerCase();
  if (forcado === "openai" && temChave("openai")) return "openai";
  if (forcado === "gemini" && temChave("gemini")) return "gemini";
  // ← PASSO 3 de 3: quando a OpenAI estiver escrita, ela vem antes desta linha.
  if (temChave("gemini")) return "gemini";
  // Chave da OpenAI sozinha ainda ESCOLHE a OpenAI, para que o erro seja
  // específico ("o caminho não existe") em vez de genérico ("nada configurado").
  // Quem pôs a chave merece saber por que não funcionou.
  if (temChave("openai")) return "openai";
  return null;
}

/**
 * Dá para gerar imagem agora?
 *
 * Exige as DUAS coisas: provedor configurado E caminho implementado. Só a chave
 * não basta, e essa é a distinção que impede a tela de oferecer um botão que
 * sempre falha.
 */
export function imagemIAConfigurada(): boolean {
  const p = provedorDeImagemConfigurado();
  return p !== null && IMPLEMENTADOS.has(p);
}

/**
 * Por que não dá. `null` quando dá.
 *
 * Existe porque "nenhum provedor" e "o provedor escolhido ainda não tem
 * caminho" mandam a pessoa a lugares diferentes — a mesma razão pela qual a
 * rota do catálogo em PDF distingue os dois casos.
 */
export function motivoImagemIndisponivel(): string | null {
  const p = provedorDeImagemConfigurado();
  if (p === null) {
    return "Nenhum provedor de imagem configurado no servidor (GEMINI_API_KEY ou OPENAI_API_KEY).";
  }
  if (!IMPLEMENTADOS.has(p)) {
    return "A geração de imagem pela OpenAI ainda não foi implementada. Configure GEMINI_API_KEY, ou remova IA_IMAGEM_PROVEDOR=openai para usar o provedor que funciona.";
  }
  return null;
}

/** Gera/edita a imagem pelo provedor configurado. */
export async function gerarImagem(e: EntradaImagemIA): Promise<SaidaImagemIA> {
  const p = provedorDeImagemConfigurado();
  if (p === null) throw new Error(motivoImagemIndisponivel() ?? "Sem provedor de imagem.");
  return p === "openai" ? gerarImagemOpenAI(e) : gerarImagemGemini(e);
}

/**
 * PASSO 1 de 3 — o corpo desta função é o que falta.
 *
 * O que precisa ser confirmado na doc antes de escrever, porque cada item já
 * mudou de forma entre versões da API de imagem da OpenAI:
 *
 *   1. o endpoint de EDIÇÃO (não o de geração) — este módulo edita a foto real;
 *   2. como a imagem de entrada viaja: multipart com arquivo, ou base64 em JSON;
 *   3. se máscara é obrigatória — se for, este caminho não serve, porque não
 *      temos máscara e inventá-la mudaria o produto;
 *   4. o formato da resposta: base64 no corpo ou URL para buscar depois;
 *   5. o nome do modelo de imagem atual.
 *
 * O item 3 é o que pode matar a ideia inteira, e é por isso que ele está na
 * lista: uma API que só edita a região de uma máscara não faz o que esta tela
 * precisa. Descobrir isso ANTES de escrever custa uma leitura; descobrir depois
 * custa o trabalho todo.
 */
export async function gerarImagemOpenAI(_e: EntradaImagemIA): Promise<SaidaImagemIA> {
  throw new Error(
    "O caminho de imagem da OpenAI ainda não foi escrito: o formato da API não pôde ser verificado neste ambiente. " +
      "Ver o cabeçalho de `provedorImagem.ts`."
  );
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
