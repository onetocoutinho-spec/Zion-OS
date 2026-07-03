// Execução real de Agentes IA via API Claude.
//
// Roda somente no servidor: a ANTHROPIC_API_KEY vem do .env.local e nunca
// chega ao navegador. Sem a chave configurada, retorna 503 e o frontend cai
// para a execução simulada (comportamento das versões anteriores).

import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120; // execuções com thinking podem demorar

const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

interface CorpoExecucao {
  agente: {
    nome: string;
    area: string;
    objetivo: string;
    quandoUsar: string;
    entradaNecessaria: string;
    saidaEsperada: string;
    promptResumido: string;
  };
  entrada?: string;
  /** Bloco de dados do sistema (cliente/produto/anúncio) montado pelo frontend. */
  contexto?: string;
}

function montarMensagem(entrada: string, contexto: string): string {
  if (!contexto) return entrada;
  return [
    `Dados cadastrados no Zion OS para esta execução:`,
    ``,
    contexto,
    ``,
    `---`,
    ``,
    `Solicitação:`,
    entrada || "Execute sua função com base nos dados acima e entregue a saída esperada.",
  ].join("\n");
}

function montarSystemPrompt(agente: CorpoExecucao["agente"]): string {
  return [
    `Você é o agente "${agente.nome}" da Zion Company, uma agência brasileira especializada em ajudar empresários a iniciar, organizar e escalar vendas em marketplaces (Mercado Livre, TikTok Shop, Shopee e Amazon).`,
    ``,
    `Área de atuação: ${agente.area}`,
    `Objetivo: ${agente.objetivo}`,
    `Quando este agente é usado: ${agente.quandoUsar}`,
    `Entrada esperada: ${agente.entradaNecessaria}`,
    `Saída esperada: ${agente.saidaEsperada}`,
    ``,
    `Instruções do agente:`,
    agente.promptResumido,
    ``,
    `Responda sempre em português do Brasil, com formatação clara em Markdown.`,
    `Entregue diretamente a saída esperada, pronta para a equipe usar — sem preâmbulos.`,
    `Se a entrada não tiver informação suficiente, entregue o melhor resultado possível e liste ao final o que faltou.`,
  ].join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        configurado: false,
        erro: "ANTHROPIC_API_KEY não configurada no .env.local. A execução será simulada.",
      },
      { status: 503 }
    );
  }

  let corpo: CorpoExecucao;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const entrada = corpo?.entrada?.trim() ?? "";
  const contexto = corpo?.contexto?.trim() ?? "";

  if (!corpo?.agente?.nome || !corpo?.agente?.promptResumido || (!entrada && !contexto)) {
    return Response.json(
      { erro: "Informe o agente e uma entrada ou um contexto para a execução." },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const resposta = await client.messages.create({
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: montarSystemPrompt(corpo.agente),
      messages: [{ role: "user", content: montarMensagem(entrada, contexto) }],
    });

    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("\n")
      .trim();

    if (resposta.stop_reason === "refusal" || !texto) {
      return Response.json(
        { erro: "O modelo não pôde completar esta solicitação. Ajuste a entrada e tente novamente." },
        { status: 422 }
      );
    }

    return Response.json({ resultado: texto, modelo: resposta.model });
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { erro: "ANTHROPIC_API_KEY inválida. Confira a chave no .env.local." },
        { status: 500 }
      );
    }
    if (erro instanceof Anthropic.RateLimitError) {
      return Response.json(
        { erro: "Limite de requisições da API Claude atingido. Aguarde alguns instantes e tente novamente." },
        { status: 429 }
      );
    }
    if (erro instanceof Anthropic.APIError) {
      return Response.json(
        { erro: `Erro da API Claude (${erro.status}): ${erro.message}` },
        { status: 500 }
      );
    }
    return Response.json(
      { erro: "Falha de conexão com a API Claude. Verifique a internet e tente novamente." },
      { status: 500 }
    );
  }
}
