// Execução da Esteira de Anúncio (Fase 1) via provedor de IA.
//
// Roda A1→A2→A9→A4→A10 numa passada só e devolve o anúncio pronto (estruturado)
// + pendências + veredito A10. Só no servidor: as chaves de IA nunca chegam ao
// navegador. Usa Gemini ou Claude (o que estiver configurado). Sem nenhuma
// chave, retorna 503 e o cliente cai para o modo simulado.

import { ESQUEMA_ANUNCIO, montarSystemPromptEsteira } from "@/lib/agentes/esteira";
import { chamarIAEstruturada, provedorConfigurado } from "@/lib/agentes/provedorIA";
import { exigirAutenticado, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { cobrarCota, reservaNoBanco, respostaCotaRecusada } from "@/lib/agentes/cotaDeIA";
import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { respostaDeErro } from "@/lib/http/respostaDeErro";
import { dadoExterno, REGRA_DO_DADO_EXTERNO } from "@/lib/agentes/dadoExterno";

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
    partes.push(
      REGRA_DO_DADO_EXTERNO,
      "",
      "Dados cadastrados no Zion OS para este produto:",
      "",
      dadoExterno("cadastro", contexto),
      "",
      "---",
      ""
    );
  }
  partes.push(
    "Briefing / instruções adicionais:",
    briefing || "Rode a esteira completa com base nos dados acima e entregue o anúncio pronto."
  );
  return partes.join("\n");
}

export async function POST(request: Request) {
  // Autorização: só usuário autenticado (no modo demo, libera). Evita que a
  // rota de IA (paga) seja chamada sem sessão.
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

  // ZION-QUOTA-001: a cota é cobrada AQUI, antes do provedor — não no botão.
  // Atômica no banco; falha fechada se a reserva não responder. Equipe e
  // agência não têm cliente_id e seguem sem cota (ver cotaDeIA.ts).
  if (ctx.perfil.clienteId) {
    if (!adminConfigurado()) {
      return Response.json({ erro: "Cota de IA indisponível no momento." }, { status: 503 });
    }
    const cota = await cobrarCota(ctx, "esteira", reservaNoBanco(getSupabaseAdmin()));
    if (!cota.ok) return respostaCotaRecusada(cota);
  }

  try {
    const { json, provedor, modelo } = await chamarIAEstruturada({
      system: montarSystemPromptEsteira(),
      mensagem: montarMensagem(briefing, contexto),
      schema: ESQUEMA_ANUNCIO,
      maxTokens: 16000,
      rastro: { origem: "esteira", clienteId: ctx.perfil.clienteId, usuarioId: ctx.usuario?.id ?? null },
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
    return respostaDeErro("agentes/esteira", erro, "Falha ao rodar a esteira.", 500);
  }
}
