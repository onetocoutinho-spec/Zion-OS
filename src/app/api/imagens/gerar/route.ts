// Geração de imagem por IA (Fase 3.2) — SOMENTE SERVIDOR.
//
// Edita a FOTO REAL do produto: "melhorar" (capa 1:1, fundo limpo) ou
// "infografico" (banner de benefícios) — sempre fiel ao produto. A chave do
// Gemini fica só no servidor. Retorna a imagem gerada em base64.

import { gerarImagem, imagemIAConfigurada, motivoImagemIndisponivel } from "@/lib/agentes/provedorImagem";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { respostaDeErro, mensagemParaONavegador } from "@/lib/http/respostaDeErro";

export const maxDuration = 60;

interface Corpo {
  imagemUrl?: string;
  imagemBase64?: string;
  mimeType?: string;
  tipo: "melhorar" | "infografico";
  beneficios?: string;
  produtoNome?: string;
}

function montarPrompt(c: Corpo): string {
  const nome = c.produtoNome ? ` do produto "${c.produtoNome}"` : "";
  if (c.tipo === "infografico") {
    return [
      `A partir da FOTO REAL${nome} em anexo, crie uma imagem QUADRADA (proporção 1:1) de e-commerce para Mercado Livre.`,
      `Mantenha o produto 100% FIEL: não altere cor, forma, material nem detalhes reais.`,
      `Componha um infográfico limpo e profissional destacando estes benefícios, com ícones simples e texto curto em PORTUGUÊS do Brasil:`,
      c.beneficios?.trim() || "conforto, qualidade e bom custo-benefício",
      `Layout de marketplace, fundo claro, legível no celular. Não invente características que o produto não tem. Sem selos ou promoções enganosas.`,
    ].join("\n");
  }
  return [
    `A partir da FOTO REAL${nome} em anexo, gere a imagem de CAPA para Mercado Livre.`,
    `Requisitos: fundo BRANCO liso e uniforme; o produto centralizado preenchendo ~85% do quadro em proporção 1:1; iluminação de estúdio suave com sombra sutil.`,
    `NÃO altere cor, forma, material ou detalhes reais do produto — apenas limpe o fundo e enquadre corretamente.`,
    `Sem texto, logotipos, selos ou marca d'água.`,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (!imagemIAConfigurada()) {
    // A mensagem vem do módulo, não daqui: "nenhum provedor" e "o provedor
    // escolhido ainda não tem caminho" mandam a pessoa a lugares diferentes, e
    // essa distinção não deve viver duplicada na rota.
    return Response.json(
      { erro: motivoImagemIndisponivel() ?? "Geração de imagem indisponível.", configurado: false },
      { status: 503 }
    );
  }

  let corpo: Corpo;
  try {
    corpo = (await request.json()) as Corpo;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  if (corpo.tipo !== "melhorar" && corpo.tipo !== "infografico") {
    return Response.json({ erro: "tipo deve ser 'melhorar' ou 'infografico'." }, { status: 400 });
  }

  // Precisa da foto real (por URL ou base64).
  let imagemBase64 = corpo.imagemBase64;
  let mimeType = corpo.mimeType;
  if (!imagemBase64 && corpo.imagemUrl) {
    try {
      const r = await fetch(corpo.imagemUrl);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      mimeType = r.headers.get("content-type") ?? "image/jpeg";
      const buf = Buffer.from(await r.arrayBuffer());
      imagemBase64 = buf.toString("base64");
    } catch (e) {
      return respostaDeErro("imagens/gerar", e, "Não foi possível baixar a foto de origem.", 400);
    }
  }
  if (!imagemBase64) {
    return Response.json(
      { erro: "Envie a foto real do produto (imagemUrl ou imagemBase64)." },
      { status: 400 }
    );
  }

  try {
    const out = await gerarImagem({
      prompt: montarPrompt(corpo),
      imagemBase64,
      mimeType,
    });
    return Response.json({ imagemBase64: out.base64, mimeType: out.mimeType });
  } catch (e) {
    return respostaDeErro("imagens/gerar", e, "Falha ao gerar a imagem.", 502);
  }
}
