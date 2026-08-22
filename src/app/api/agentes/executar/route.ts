// Execução real de Agentes IA via provedor de IA (Gemini ou Claude).
//
// Roda somente no servidor: as chaves (GEMINI_API_KEY / ANTHROPIC_API_KEY) vêm
// do .env.local e nunca chegam ao navegador. Sem nenhuma chave, retorna 503 e o
// frontend cai para a execução simulada (comportamento das versões anteriores).

import { chamarIAEstruturada, provedorConfigurado } from "@/lib/agentes/provedorIA";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { cobrarCota, reservaNoBanco, respostaCotaRecusada } from "@/lib/agentes/cotaDeIA";
import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { respostaDeErro } from "@/lib/http/respostaDeErro";

// 60s = limite do plano Hobby (grátis) da Vercel.
export const maxDuration = 60;

// Envelope estruturado comum a todos os agentes: a entrega principal continua
// livre (Markdown), e dois extras opcionais alimentam os botões de ação do
// Zion OS ("Aplicar no anúncio" e "Criar tarefa").
const ESQUEMA_RESULTADO = {
  type: "object",
  properties: {
    resultado_markdown: {
      type: "string",
      description:
        "A entrega completa do agente em Markdown, pronta para a equipe usar. É o conteúdo principal.",
    },
    titulo_otimizado: {
      type: ["string", "null"],
      description:
        "Somente quando a entrega incluir um título de anúncio otimizado: o título final (máximo 60 caracteres), sem aspas. Caso contrário, null.",
    },
    tarefas_sugeridas: {
      type: "array",
      description:
        "Até 5 tarefas acionáveis que a equipe da agência deveria executar a partir desta entrega. Lista vazia se não houver.",
      items: {
        type: "object",
        properties: {
          tarefa: { type: "string", description: "Descrição curta e objetiva da tarefa" },
          prioridade: { type: "string", enum: ["Baixa", "Média", "Alta", "Urgente"] },
          proximaAcao: { type: "string", description: "Primeiro passo concreto para executá-la" },
        },
        required: ["tarefa", "prioridade", "proximaAcao"],
        additionalProperties: false,
      },
    },
  },
  required: ["resultado_markdown", "titulo_otimizado", "tarefas_sugeridas"],
  additionalProperties: false,
};

interface ResultadoEstruturado {
  resultado_markdown: string;
  titulo_otimizado: string | null;
  tarefas_sugeridas: {
    tarefa: string;
    prioridade: "Baixa" | "Média" | "Alta" | "Urgente";
    proximaAcao: string;
  }[];
}

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
    `Responda sempre em português do Brasil, com formatação clara em Markdown no campo resultado_markdown.`,
    `Entregue diretamente a saída esperada, pronta para a equipe usar — sem preâmbulos.`,
    `Se a entrada não tiver informação suficiente, entregue o melhor resultado possível e liste ao final o que faltou.`,
  ].join("\n");
}

export async function POST(request: Request) {
  let ctx;
  try {
    ctx = await exigirAutenticado(request);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (!provedorConfigurado()) {
    return Response.json(
      {
        configurado: false,
        erro: "Nenhum provedor de IA configurado (GEMINI_API_KEY ou ANTHROPIC_API_KEY). A execução será simulada.",
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

  // ZION-QUOTA-001: a cota é cobrada AQUI, antes do provedor — não no botão.
  // Atômica no banco; falha fechada se a reserva não responder. Equipe e
  // agência não têm cliente_id e seguem sem cota (ver cotaDeIA.ts).
  if (ctx.perfil.clienteId) {
    if (!adminConfigurado()) {
      return Response.json({ erro: "Cota de IA indisponível no momento." }, { status: 503 });
    }
    const cota = await cobrarCota(ctx, "agente", reservaNoBanco(getSupabaseAdmin()));
    if (!cota.ok) return respostaCotaRecusada(cota);
  }

  try {
    const { json, modelo } = await chamarIAEstruturada({
      system: montarSystemPrompt(corpo.agente),
      mensagem: montarMensagem(entrada, contexto),
      schema: ESQUEMA_RESULTADO,
      maxTokens: 8000,
    });

    try {
      const estruturado = JSON.parse(json) as ResultadoEstruturado;
      return Response.json({
        resultado: estruturado.resultado_markdown,
        tituloOtimizado: estruturado.titulo_otimizado,
        tarefasSugeridas: estruturado.tarefas_sugeridas ?? [],
        modelo,
      });
    } catch {
      // Defesa: se não vier JSON válido, devolve o texto cru.
      return Response.json({ resultado: json, modelo });
    }
  } catch (erro) {
    return respostaDeErro("agentes/executar", erro, "Falha ao executar o agente.", 500);
  }
}
