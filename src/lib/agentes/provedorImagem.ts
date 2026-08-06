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
// DOIS PROVEDORES, E O FORMATO QUE FOI MEDIDO EM VEZ DE LEMBRADO
// ===========================================================================
//
// A decisão do dono (05/08/2026) é substituir o Gemini pela OpenAI aqui — é o
// único lugar do projeto que ainda não fala com o Claude, e o Claude não gera
// imagem.
//
// A chamada da OpenAI ficou SEM CORPO por um dia inteiro, de propósito: a rede
// do ambiente de desenvolvimento não alcança `api.openai.com` nem a doc dela
// (medido `http=000` em 05 e 06/08), então o formato não podia ser verificado.
// Escrever de memória foi exatamente o que produziu os schemas em
// `type: "OBJECT"` que quase foram para produção no mesmo dia — o dialeto errado
// passa por typecheck, passa por teste, e só a API reclama.
//
// EM 06/08/2026 O FORMATO FOI MEDIDO, na máquina do dono, contra a API real. O
// método: mandar a requisição INCOMPLETA e ler o que ela cobra. A OpenAI valida
// um campo por vez, então cada resposta nomeia o próximo obrigatório — e erro de
// validação não gera imagem nem é cobrado.
//
//     POST /v1/images/edits  (multipart/form-data)
//       sem nada          → "Incorrect API key"       (valida credencial antes)
//       com a chave       → "Missing required: model"
//       com model         → "Missing required: image"
//
// A PERGUNTA QUE PODIA MATAR A IDEIA INTEIRA ERA `mask`, e ela NÃO é obrigatória:
// depois de `model` a API cobra `image`, não máscara. Isso é o que autoriza este
// caminho a existir — uma API que só editasse a região de uma máscara não
// serviria, porque este projeto não tem máscara e inventar uma mudaria o produto,
// que é o que este módulo existe para nunca fazer.
//
// Modelos que a conta oferece, lidos de `GET /v1/models`:
//
//     gpt-image-1   gpt-image-1-mini   gpt-image-1.5
//     gpt-image-2   gpt-image-2-2026-04-21   chatgpt-image-latest
//
// O padrão é `gpt-image-2`, e é sobrescrevível por `OPENAI_IMAGE_MODEL` — porque
// esta lista foi lida numa conta e num dia, e a próxima pode ser outra.
//
// O QUE CONTINUA NÃO MEDIDO: o formato da RESPOSTA. Descobri-lo exigiria uma
// edição de verdade, que custa. Então a leitura aceita as DUAS formas que a API
// de imagem usa — base64 em `b64_json` e `url` para buscar depois — do mesmo jeito
// que o caminho do Gemini aceita `inlineData` e `inline_data`. Ser tolerante na
// leitura é diferente de adivinhar na escrita: aqui as duas formas são tratadas,
// e o erro só aparece se vier uma terceira.
//
// A PREFERÊNCIA CONTINUA NO GEMINI quando ele tem chave. Só
// `IA_IMAGEM_PROVEDOR=openai` inverte, ou a ausência da chave do Gemini. A
// inversão do provedor de texto ensinou que "qual inteligência atende a lojista
// decidido pela presença de uma variável de ambiente" é um efeito que ninguém
// escolhe — e trocar o provedor de imagem de quem está no ar é decisão do dono,
// não consequência de um commit. Há teste em cima disso.

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
 * É DADO, não um `if` espalhado. A OpenAI entrou aqui em 06/08/2026, depois de o
 * formato da requisição ser MEDIDO contra a API real — não antes. Enquanto ela
 * estava fora, nenhum lugar do sistema podia achar que aquele caminho
 * funcionava, e `motivoImagemIndisponivel` dizia exatamente por quê.
 */
const IMPLEMENTADOS: ReadonlySet<ProvedorDeImagem> = new Set<ProvedorDeImagem>([
  "gemini",
  "openai",
]);

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
    // Genérico de propósito: hoje os dois caminhos existem, então esta linha só é
    // alcançada por um provedor NOVO que alguém acrescentou ao tipo e esqueceu de
    // escrever. Nomear a OpenAI aqui viraria mentira no dia em que ela passou a
    // funcionar — e foi 06/08/2026.
    return `O caminho de imagem "${p}" está escolhido e não foi implementado. Configure outro provedor, ou escreva o caminho dele.`;
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
 * Edita a foto real pela OpenAI.
 *
 * O FORMATO AQUI FOI MEDIDO, não lembrado — ver o cabeçalho. A API valida um
 * campo por vez, e o que ela cobrou, em ordem, foi: `model`, depois `image`.
 * `mask` NÃO é obrigatória, e é isso que autoriza este caminho a existir.
 *
 * `prompt` não chegou a ser cobrado na medição (ela parou em `image`, porque
 * mandar imagem pelo terminal exigiria um arquivo). Ele vai porque é o que a
 * função faz — instruir a edição — e se a API não o quisesse, ela reclamaria de
 * campo desconhecido em vez de falhar em silêncio.
 */
export async function gerarImagemOpenAI(e: EntradaImagemIA): Promise<SaidaImagemIA> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("OPENAI_API_KEY não configurada no servidor.");

  // SEM IMAGEM DE ENTRADA ESTE CAMINHO NÃO SERVE, e a recusa é o ponto.
  //
  // `/images/edits` exige `image`. Poderíamos cair para `/images/generations` e
  // gerar do zero — e aí a IA INVENTARIA o produto, que é a única coisa que este
  // módulo nunca pode fazer. Um sofá plausível que não é o sofá dela é uma
  // infração DOMAIN, e esta conta já tem 110.
  if (!e.imagemBase64) {
    throw new Error(
      "A edição pela OpenAI precisa da foto real do produto. Sem foto de entrada não há o que editar — " +
        "e gerar do zero inventaria o produto, o que este sistema não faz."
    );
  }

  const modelo = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
  const mime = e.mimeType ?? "image/jpeg";

  // multipart, porque foi assim que a medição passou (`-F` no curl). A imagem vai
  // como ARQUIVO, não como base64 em JSON.
  const form = new FormData();
  form.append("model", modelo);
  form.append("prompt", e.prompt);
  form.append("image", new Blob([bytesDeBase64(e.imagemBase64)], { type: mime }), nomeDoArquivo(mime));

  const resp = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}` },
    body: form,
    // Editar imagem é lento. Sem prazo, uma chamada pendurada consome o tempo
    // inteiro da rota e a lojista vê a tela travar sem motivo.
    signal: AbortSignal.timeout(120_000),
  });

  const dados = (await resp.json().catch(() => ({}))) as {
    data?: { b64_json?: string; url?: string }[];
    error?: { message?: string };
  };

  if (!resp.ok) {
    // A mensagem da OpenAI vai junto, cortada: ela nomeia o campo que falta, e
    // foi exatamente assim que este caminho foi descoberto. Esconder isso faria o
    // próximo defeito de formato levar horas em vez de uma leitura.
    const msg = dados.error?.message ?? `HTTP ${resp.status}`;
    throw new Error(`OpenAI imagem ${resp.status}: ${msg}`.slice(0, 400));
  }

  const primeiro = dados.data?.[0];

  // AS DUAS FORMAS DE RESPOSTA, porque o formato da RESPOSTA não foi medido —
  // medir exigiria uma edição de verdade, que custa. As APIs de imagem devolvem
  // base64 ou uma URL temporária, e as duas são tratadas. Ser tolerante na
  // LEITURA é diferente de adivinhar na ESCRITA: se vier uma terceira forma, o
  // erro abaixo diz isso em vez de devolver imagem vazia.
  if (primeiro?.b64_json) {
    return { base64: primeiro.b64_json, mimeType: "image/png" };
  }
  if (primeiro?.url) {
    const img = await fetch(primeiro.url, { signal: AbortSignal.timeout(30_000) });
    if (!img.ok) throw new Error(`A imagem foi gerada mas não deu para buscá-la (HTTP ${img.status}).`);
    const buf = Buffer.from(await img.arrayBuffer());
    return { base64: buf.toString("base64"), mimeType: img.headers.get("content-type") ?? "image/png" };
  }

  throw new Error(
    "A OpenAI respondeu sem imagem, em formato que este caminho não conhece. " +
      "Ver o cabeçalho de `provedorImagem.ts`: a resposta esperada tem `b64_json` ou `url`."
  );
}

/**
 * base64 → bytes, num buffer que o `Blob` aceita.
 *
 * O tipo é `ArrayBuffer` e não `Uint8Array` de propósito: `Buffer.from` devolve
 * `ArrayBufferLike`, que pode ser `SharedArrayBuffer`, e o `Blob` recusa isso no
 * typecheck. A cópia resolve e custa uma alocação por imagem — irrelevante ao
 * lado de uma chamada de rede de dois minutos.
 */
function bytesDeBase64(b64: string): ArrayBuffer {
  // Tolera o prefixo `data:` porque quem chama pode ter esquecido de tirá-lo, e
  // um prefixo esquecido corromperia a imagem inteira de forma silenciosa.
  const limpo = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const buf = Buffer.from(limpo, "base64");
  const saida = new ArrayBuffer(buf.byteLength);
  new Uint8Array(saida).set(buf);
  return saida;
}

/**
 * O nome do arquivo no multipart.
 *
 * A extensão precisa casar com o mime: APIs de imagem costumam rejeitar
 * `foto.png` que na verdade é JPEG, e o erro que isso produz fala de formato
 * inválido, não de nome — o que manda quem depura para o lugar errado.
 */
function nomeDoArquivo(mime: string): string {
  if (/png/i.test(mime)) return "produto.png";
  if (/webp/i.test(mime)) return "produto.webp";
  return "produto.jpg";
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
