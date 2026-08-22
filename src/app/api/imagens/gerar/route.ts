// Geração de imagem por IA (Fase 3.2) — SOMENTE SERVIDOR.
//
// Edita a FOTO REAL do produto: "melhorar" (capa 1:1, fundo limpo) ou
// "infografico" (banner de benefícios) — sempre fiel ao produto. A chave do
// Gemini fica só no servidor. Retorna a imagem gerada em base64.
//
// A FOTO DE ORIGEM vem do bucket do projeto, e de mais lugar nenhum. Esta
// rota fazia `fetch(corpo.imagemUrl)` para qualquer endereço — SSRF a partir
// do servidor, e o que baixasse virava anexo para o provedor. Agora a URL
// precisa apontar para `produtos-imagens/<clienteId>/...` do Supabase do
// projeto, e a sessão precisa alcançar ESSA loja (`exigirAcessoAoCliente`).
// E a geração, o item mais caro por unidade, passa a cobrar cota — era a
// única rota de IA fora dela. (Auditoria do Copilot, 2026-08-22, P1.)

import { gerarImagem, imagemIAConfigurada, motivoImagemIndisponivel } from "@/lib/agentes/provedorImagem";
import {
  exigirAcessoAoCliente,
  exigirAutenticado,
  respostaErroAutorizacao,
  type ContextoAutorizado,
} from "@/lib/auth/serverAuthorization";
import { cobrarCota, reservaNoBanco, respostaCotaRecusada } from "@/lib/agentes/cotaDeIA";
import { adminConfigurado, getSupabaseAdmin } from "@/lib/supabase/admin";
import { MAXIMO_DA_FOTO_BYTES, TIMEOUT_DA_FOTO_MS, origemDaFoto } from "@/lib/agentes/origemDaFoto";
import { respostaDeErro } from "@/lib/http/respostaDeErro";
import { dadoExterno, REGRA_DO_DADO_EXTERNO } from "@/lib/agentes/dadoExterno";

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
  // Nome e benefícios vêm do navegador (e o nome, antes, do ML ou do CSV):
  // são DADO, entram cercados e com teto. Ver `dadoExterno.ts`.
  const nome = c.produtoNome ? ` do produto ${dadoExterno("cadastro-nome", c.produtoNome.slice(0, 200))}` : "";
  if (c.tipo === "infografico") {
    return [
      REGRA_DO_DADO_EXTERNO,
      `A partir da FOTO REAL${nome} em anexo, crie uma imagem QUADRADA (proporção 1:1) de e-commerce para Mercado Livre.`,
      `Mantenha o produto 100% FIEL: não altere cor, forma, material nem detalhes reais.`,
      `Componha um infográfico limpo e profissional destacando estes benefícios, com ícones simples e texto curto em PORTUGUÊS do Brasil:`,
      dadoExterno("beneficios", c.beneficios?.trim().slice(0, 1000) || "conforto, qualidade e bom custo-benefício"),
      `Layout de marketplace, fundo claro, legível no celular. Não invente características que o produto não tem. Sem selos ou promoções enganosas.`,
    ].join("\n");
  }
  return [
    REGRA_DO_DADO_EXTERNO,
    `A partir da FOTO REAL${nome} em anexo, gere a imagem de CAPA para Mercado Livre.`,
    `Requisitos: fundo BRANCO liso e uniforme; o produto centralizado preenchendo ~85% do quadro em proporção 1:1; iluminação de estúdio suave com sombra sutil.`,
    `NÃO altere cor, forma, material ou detalhes reais do produto — apenas limpe o fundo e enquadre corretamente.`,
    `Sem texto, logotipos, selos ou marca d'água.`,
  ].join("\n");
}

export async function POST(request: Request) {
  // A sessão é exigida já aqui; a autorização por LOJA vem depois, quando a
  // origem da foto disser de que loja ela é.
  let ctx: ContextoAutorizado;
  try {
    ctx = await exigirAutenticado(request);
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

  // Precisa da foto real (por URL do bucket do projeto, ou base64).
  let imagemBase64 = corpo.imagemBase64;
  let mimeType = corpo.mimeType;
  if (!imagemBase64 && corpo.imagemUrl) {
    const origem = origemDaFoto(corpo.imagemUrl, process.env.NEXT_PUBLIC_SUPABASE_URL);
    if (!origem.ok) return Response.json({ erro: origem.motivo }, { status: 400 });
    // A foto é da loja `origem.clienteId`. A sessão alcança essa loja?
    // Lojista: só a própria; agência: as dela; equipe: qualquer. Quem decide
    // é o banco, via `exigirAcessoAoCliente` — e "não é sua" responde 403
    // igual a "não existe".
    try {
      ctx = await exigirAcessoAoCliente(request, origem.clienteId);
    } catch (e) {
      return respostaErroAutorizacao(e);
    }
    try {
      const r = await fetch(origem.url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_DA_FOTO_MS),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const declarado = Number(r.headers.get("content-length") ?? 0);
      if (declarado > MAXIMO_DA_FOTO_BYTES) throw new Error("foto acima do teto");
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.byteLength > MAXIMO_DA_FOTO_BYTES) throw new Error("foto acima do teto");
      mimeType = r.headers.get("content-type") ?? "image/jpeg";
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
  if (imagemBase64.length > MAXIMO_DA_FOTO_BYTES * 1.4) {
    return Response.json({ erro: "A foto é grande demais." }, { status: 413 });
  }

  // ZION-COST-001: a cota é cobrada AQUI, antes do provedor. Imagem é a
  // chamada mais cara por unidade e era a única rota de IA sem cota. Equipe
  // e agência seguem sem cota (ver cotaDeIA.ts).
  if (ctx.perfil.clienteId) {
    if (!adminConfigurado()) {
      return Response.json({ erro: "Cota de IA indisponível no momento." }, { status: 503 });
    }
    const cota = await cobrarCota(ctx, "imagem", reservaNoBanco(getSupabaseAdmin()));
    if (!cota.ok) return respostaCotaRecusada(cota);
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
