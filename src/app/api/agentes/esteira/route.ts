// Execução da Esteira de Anúncio (Fase 1) via API Claude.
//
// Roda A1→A2→A9→A4→A10 numa passada só e devolve o anúncio pronto (estruturado)
// + pendências + veredito A10. Só no servidor: a ANTHROPIC_API_KEY nunca chega
// ao navegador. Sem a chave, retorna 503 e o cliente cai para o modo simulado.

import Anthropic from "@anthropic-ai/sdk";
import { ESQUEMA_ANUNCIO, montarSystemPromptEsteira } from "@/lib/agentes/esteira";

export const maxDuration = 120;

const MODELO = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

interface CorpoEsteira {
  /** Nome/identificação do produto (para logs e título). */
  produto?: string;
  /** Briefing livre digitado pelo operador (opcional). */
  briefing?: string;
  /** Bloco de dados do sistema (cliente/produto/anúncio) montado pelo frontend. */
  contexto?: string;
}

function montarMensagem(briefing: string, contexto: string): string {
  const partes: string[] = [];
  if (contexto) {
    partes.push("Dados cadastrados no Zion OS para este produto:", "", contexto, "", "---", "");
  }
  partes.push(
    "Briefing / instruções adicionais:",
    briefing || "Rode a esteira completa com base nos dados acima e entregue o anúncio pronto."
  );
  return partes.join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      {
        configurado: false,
        erro: "ANTHROPIC_API_KEY não configurada no .env.local. A esteira será simulada.",
      },
      { status: 503 }
    );
  }

  let corpo: CorpoEsteira;
  try {
    corpo = await request.json();
  } catch {
    return Response.json({ erro: "Corpo da requisição inválido." }, { status: 400 });
  }

  const briefing = corpo?.briefing?.trim() ?? "";
  const contexto = corpo?.contexto?.trim() ?? "";
  if (!briefing && !contexto) {
    return Response.json(
      { erro: "Informe um produto (contexto) ou um briefing para rodar a esteira." },
      { status: 400 }
    );
  }

  const client = new Anthropic({ apiKey });

  try {
    const resposta = await client.messages.create({
      model: MODELO,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: montarSystemPromptEsteira(),
      output_config: { format: { type: "json_schema", schema: ESQUEMA_ANUNCIO } },
      messages: [{ role: "user", content: montarMensagem(briefing, contexto) }],
    });

    const texto = resposta.content
      .filter((bloco) => bloco.type === "text")
      .map((bloco) => bloco.text)
      .join("\n")
      .trim();

    if (resposta.stop_reason === "refusal" || !texto) {
      return Response.json(
        { erro: "O modelo não pôde completar esta solicitação. Ajuste o briefing e tente novamente." },
        { status: 422 }
      );
    }

    try {
      const anuncio = JSON.parse(texto);
      return Response.json({ anuncio, modelo: resposta.model });
    } catch {
      return Response.json(
        { erro: "A esteira retornou um resultado que não pôde ser lido. Tente novamente." },
        { status: 502 }
      );
    }
  } catch (erro) {
    if (erro instanceof Anthropic.AuthenticationError) {
      return Response.json({ erro: "ANTHROPIC_API_KEY inválida. Confira a chave no .env.local." }, { status: 500 });
    }
    if (erro instanceof Anthropic.RateLimitError) {
      return Response.json(
        { erro: "Limite de requisições da API Claude atingido. Aguarde e tente novamente." },
        { status: 429 }
      );
    }
    if (erro instanceof Anthropic.APIError) {
      return Response.json({ erro: `Erro da API Claude (${erro.status}): ${erro.message}` }, { status: 500 });
    }
    return Response.json(
      { erro: "Falha de conexão com a API Claude. Verifique a internet e tente novamente." },
      { status: 500 }
    );
  }
}
