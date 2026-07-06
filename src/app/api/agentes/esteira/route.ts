// Execução da Esteira de Anúncio (Fase 1) via provedor de IA.
//
// Roda A1→A2→A9→A4→A10 numa passada só e devolve o anúncio pronto (estruturado)
// + pendências + veredito A10. Só no servidor: as chaves de IA nunca chegam ao
// navegador. Usa Gemini ou Claude (o que estiver configurado). Sem nenhuma
// chave, retorna 503 e o cliente cai para o modo simulado.

import { ESQUEMA_ANUNCIO, montarSystemPromptEsteira } from "@/lib/agentes/esteira";
import { chamarIAEstruturada, provedorConfigurado } from "@/lib/agentes/provedorIA";

// 60s = limite do plano Hobby (grátis) da Vercel. A esteira (Gemini) roda em
// ~25–40s. Em plano pago dá para subir para 300.
export const maxDuration = 60;

interface CorpoEsteira {
  produto?: string;
  briefing?: string;
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
  if (!provedorConfigurado()) {
    return Response.json(
      {
        configurado: false,
        erro: "Nenhum provedor de IA configurado (GEMINI_API_KEY ou ANTHROPIC_API_KEY). A esteira será simulada.",
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

  try {
    const { json, provedor, modelo } = await chamarIAEstruturada({
      system: montarSystemPromptEsteira(),
      mensagem: montarMensagem(briefing, contexto),
      schema: ESQUEMA_ANUNCIO,
      maxTokens: 16000,
    });

    let anuncio: unknown;
    try {
      anuncio = JSON.parse(json);
    } catch {
      return Response.json(
        { erro: "A esteira retornou um resultado que não pôde ser lido. Tente novamente." },
        { status: 502 }
      );
    }
    return Response.json({ anuncio, provedor, modelo });
  } catch (erro) {
    return Response.json(
      { erro: erro instanceof Error ? erro.message : "Falha ao rodar a esteira." },
      { status: 500 }
    );
  }
}
