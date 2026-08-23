// O ROTEAMENTO DE MODELO — declarativo, num lugar só.
//
// A escolha do modelo vivia em dois arquivos (`provedorIA.ts` com Opus,
// `conversaComFerramentas.ts` com Sonnet) e em variáveis de ambiente soltas;
// não havia reserva: se o modelo principal estivesse sobrecarregado, o turno
// morria. E nada registrava que uma chamada rodou "no modelo de reserva".
// (Auditoria do Copilot, trilha 8 / LATER.)
//
// Aqui: uma tabela por tarefa — modelo principal, reserva e esforço — e a
// decisão de quando cair para a reserva (só sobrecarga/indisponibilidade,
// nunca erro de entrada). Quem chama registra `degradado: true` quando a
// reserva foi usada. Env continua mandando: a tabela lê as variáveis e dá o
// padrão. Puro.
//
// Desde 23/08/2026 a tabela é POR PROVEDOR: o dono decidiu que o projeto fala
// só com o ChatGPT, então a linha da OpenAI é a que vale quando a chave dela
// existe. As linhas da Anthropic ficam para quem pedir por nome
// (`IA_PROVEDOR=anthropic`) — ver `provedorConfigurado`.

export type TarefaDeIA = "estruturada" | "conversa";
export type ProvedorRoteado = "openai" | "anthropic";

export interface RotaDeModelo {
  principal: string;
  /** O modelo de reserva para sobrecarga. `null` = sem reserva (morre). */
  reserva: string | null;
}

/**
 * Os padrões da OpenAI. `gpt-5` para tudo — o chat com ferramentas de vários
 * passos é onde o raciocínio importa, e a reserva é o `gpt-5-mini`, mais
 * barato e raramente sobrecarregado ao mesmo tempo. Sobrescrevíveis por env.
 */
export const MODELO_OPENAI_PADRAO = "gpt-5";
export const MODELO_OPENAI_RESERVA_PADRAO = "gpt-5-mini";

/** Qual provedor a tabela deve ler — a MESMA ordem de `provedorConfigurado`. */
export function provedorRoteado(env: NodeJS.ProcessEnv = process.env): ProvedorRoteado {
  const forcado = env.IA_PROVEDOR?.toLowerCase();
  if (forcado === "anthropic" && env.ANTHROPIC_API_KEY) return "anthropic";
  if (forcado === "openai" && env.OPENAI_API_KEY) return "openai";
  if (env.OPENAI_API_KEY) return "openai";
  return "anthropic";
}

export function rotaDoModelo(
  tarefa: TarefaDeIA,
  env: NodeJS.ProcessEnv = process.env,
  provedor: ProvedorRoteado = provedorRoteado(env)
): RotaDeModelo {
  if (provedor === "openai") {
    if (tarefa === "conversa") {
      return {
        principal: env.OPENAI_MODELO_CONVERSA ?? env.OPENAI_MODEL ?? MODELO_OPENAI_PADRAO,
        reserva: env.OPENAI_MODELO_CONVERSA_RESERVA ?? env.OPENAI_MODEL_RESERVA ?? MODELO_OPENAI_RESERVA_PADRAO,
      };
    }
    return {
      principal: env.OPENAI_MODEL ?? MODELO_OPENAI_PADRAO,
      reserva: env.OPENAI_MODEL_RESERVA ?? MODELO_OPENAI_RESERVA_PADRAO,
    };
  }
  if (tarefa === "conversa") {
    return {
      principal: env.ANTHROPIC_MODELO_CONVERSA ?? "claude-sonnet-5",
      reserva: env.ANTHROPIC_MODELO_CONVERSA_RESERVA ?? null,
    };
  }
  return {
    principal: env.ANTHROPIC_MODEL ?? "claude-opus-5",
    // A reserva do Opus é o Sonnet: mais barato e raramente sobrecarregado
    // ao mesmo tempo. Só vale se o dono não disser outra coisa.
    reserva: env.ANTHROPIC_MODEL_RESERVA ?? "claude-sonnet-5",
  };
}

/**
 * Só SOBRECARGA ou INDISPONIBILIDADE justificam a reserva: 529, 503, 429 e
 * "overloaded". Erro de entrada (400), de autorização (401/403) ou de schema
 * no modelo de reserva daria a mesma resposta — e esconderia a causa.
 */
export function cabeReserva(e: unknown): boolean {
  const status = (e as { status?: number } | null)?.status;
  if (status === 529 || status === 503 || status === 429) return true;
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /overloaded|sobrecarregado|rate limit|capacity/i.test(msg);
}
