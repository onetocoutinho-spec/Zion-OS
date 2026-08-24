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

/**
 * O QUE O ROTEAMENTO LÊ DO AMBIENTE — e só isto.
 *
 * A assinatura pedia `NodeJS.ProcessEnv`, o ambiente INTEIRO, para ler onze
 * variáveis. Duas consequências, e a segunda é a que doeu:
 *
 * 1. A assinatura não dizia o que a função consulta. Quem fosse trocar o nome
 *    de uma variável tinha de ler o corpo para saber se este módulo a usava.
 * 2. O `ProcessEnv` do Next declara `NODE_ENV` como OBRIGATÓRIO
 *    (`node_modules/next/types/global.d.ts`), então montar um ambiente de
 *    teste com três variáveis exigia `as NodeJS.ProcessEnv` — um cast que o
 *    compilador recusa desde então, e que era o que fazia `typecheck:test`
 *    falhar em `faixaLater.test.ts`. O cast não era um detalhe do teste: era
 *    o teste dizendo que a assinatura pedia demais.
 *
 * `process.env` continua servindo (o índice `[key: string]` dele satisfaz
 * estes campos opcionais), então nenhum chamador muda.
 */
export interface AmbienteDoModelo {
  IA_PROVEDOR?: string;
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_MODEL_RESERVA?: string;
  OPENAI_MODELO_CONVERSA?: string;
  OPENAI_MODELO_CONVERSA_RESERVA?: string;
  ANTHROPIC_MODEL?: string;
  ANTHROPIC_MODEL_RESERVA?: string;
  ANTHROPIC_MODELO_CONVERSA?: string;
  ANTHROPIC_MODELO_CONVERSA_RESERVA?: string;
  /**
   * O resto do ambiente, ignorado aqui.
   *
   * O índice NÃO é decoração: sem ele o tipo teria só campos opcionais e o
   * TypeScript o trataria como "weak type" — a regra que exige ao menos uma
   * propriedade DECLARADA em comum entre origem e destino. O `ProcessEnv` do
   * Node é `interface ProcessEnv extends Dict<string>`, ou seja, índice e mais
   * nada; nenhuma das onze acima está declarada nele, e passar `process.env`
   * seria recusado com "has no properties in common".
   */
  [outra: string]: string | undefined;
}

/** Qual provedor a tabela deve ler — a MESMA ordem de `provedorConfigurado`. */
export function provedorRoteado(env: AmbienteDoModelo = process.env): ProvedorRoteado {
  const forcado = env.IA_PROVEDOR?.toLowerCase();
  if (forcado === "anthropic" && env.ANTHROPIC_API_KEY) return "anthropic";
  if (forcado === "openai" && env.OPENAI_API_KEY) return "openai";
  if (env.OPENAI_API_KEY) return "openai";
  return "anthropic";
}

export function rotaDoModelo(
  tarefa: TarefaDeIA,
  env: AmbienteDoModelo = process.env,
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
