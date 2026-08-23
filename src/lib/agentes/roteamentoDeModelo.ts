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

export type TarefaDeIA = "estruturada" | "conversa";

export interface RotaDeModelo {
  principal: string;
  /** O modelo de reserva para sobrecarga. `null` = sem reserva (morre). */
  reserva: string | null;
}

export function rotaDoModelo(tarefa: TarefaDeIA, env: NodeJS.ProcessEnv = process.env): RotaDeModelo {
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
