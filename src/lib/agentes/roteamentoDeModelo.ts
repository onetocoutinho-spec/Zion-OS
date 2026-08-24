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

export type TarefaDeIA = "estruturada" | "conversa" | "classificacao";
export type ProvedorRoteado = "openai" | "anthropic";

export interface RotaDeModelo {
  principal: string;
  /** O modelo de reserva para sobrecarga. `null` = sem reserva (morre). */
  reserva: string | null;
}

/**
 * O padrão do TRABALHO PESADO: esteira, extração de catálogo em PDF, título e
 * descrição.
 *
 * Continua no `gpt-5`, e a decisão é deliberada mesmo depois de o dono pedir
 * "os modelos mais rápidos" em 24/08/2026. A régua não é a mesma para as duas
 * famílias de chamada:
 *
 *   CHAT       chamada frequente, uma pessoa esperando na tela, e o erro é
 *              visível e corrigível na próxima fala.
 *   ESTEIRA    chamada rara, ninguém esperando, e o erro ENTRA NO CADASTRO em
 *              escala — um título ruim vira 40 anúncios ruins, e a lojista
 *              descobre semanas depois, pela venda que não veio.
 *
 * Trocar este por um modelo menor economizaria segundos que ninguém está
 * contando e pagaria com a única coisa que este projeto inteiro protege: o que
 * fica gravado. Quem quiser mesmo assim: `OPENAI_MODEL=gpt-5-mini`.
 */
export const MODELO_OPENAI_PADRAO = "gpt-5";
export const MODELO_OPENAI_RESERVA_PADRAO = "gpt-5-mini";

/**
 * O modelo do CHAT — `gpt-5-mini` desde 24/08/2026.
 *
 * ===========================================================================
 * O QUE FOI MEDIDO
 * ===========================================================================
 *
 * No gpt-5, um turno de três passos levou **107 segundos** em produção — e só
 * chamou uma ferramenta, duas vezes. O custo não eram as ferramentas nem os
 * tokens: eram as três chamadas de modelo, ~30 s cada, porque o gpt-5 raciocina
 * antes de responder e o laço faz uma chamada por passo.
 *
 * Cento e sete segundos é uma pessoa achando que o sistema travou.
 *
 * ===========================================================================
 * O QUE SE PAGA, E O QUE SEGURA
 * ===========================================================================
 *
 * O mini escolhe ferramenta pior em pedido ambíguo. Três coisas seguram isso,
 * e nenhuma depende da inteligência do modelo:
 *
 *   - o passo 0 só alcança LEITURA (a fronteira do INC-003);
 *   - o roteamento por especialista entrega 9 a 15 ferramentas em vez de 34 —
 *     escolher entre menos é mais fácil, e ajuda o modelo menor mais do que
 *     ajudava o grande;
 *   - tudo que tem efeito passa por proposta e clique humano, com trava de
 *     posse e de infração no servidor.
 *
 * A RESERVA é o `gpt-5`: como na classificação, cair por sobrecarga não pode
 * cair para pior. `OPENAI_MODELO_CONVERSA=gpt-5` volta atrás sem deploy.
 */
export const MODELO_OPENAI_CONVERSA = "gpt-5-mini";
/**
 * O modelo de CLASSIFICAR UMA FRASE — "isto é pergunta de peso ou de preço?".
 *
 * `gpt-5-mini`, e a reserva é o `gpt-5` — a única linha da tabela em que a
 * reserva é MAIS forte que o principal, porque aqui a queda por sobrecarga não
 * pode piorar a classificação.
 *
 * Medido em produção em 24/08/2026: a classificação no gpt-5 com esforço
 * `low` levou 9,5s e gastou 630 tokens de saída — quase tudo raciocínio, para
 * decidir uma coisa que o schema já restringe a um punhado de valores. Somados
 * aos 31s do turno do chat, a lojista esperava ~40s por pergunta.
 */
export const MODELO_OPENAI_CLASSIFICACAO = "gpt-5-mini";

/**
 * Por que a classificação NÃO desce para o `gpt-5-nano`.
 *
 * Ela decide o critério da resposta e o especialista do turno — errar aqui não
 * deixa a resposta lenta, deixa a resposta sobre outro assunto. E o ganho seria
 * pequeno: medido em 24/08/2026, o mini classifica em ~2 s. Não há segundo a
 * ganhar que pague um turno inteiro no assunto errado.
 */

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
    if (tarefa === "classificacao") {
      return {
        principal: env.OPENAI_MODELO_CLASSIFICACAO ?? MODELO_OPENAI_CLASSIFICACAO,
        reserva: env.OPENAI_MODELO_CLASSIFICACAO_RESERVA ?? MODELO_OPENAI_PADRAO,
      };
    }
    if (tarefa === "conversa") {
      return {
        // Sem `?? env.OPENAI_MODEL`: o chat tem linha PRÓPRIA desde 24/08/2026,
        // e herdar o modelo do trabalho pesado o traria de volta ao gpt-5 em
        // qualquer ambiente que só defina OPENAI_MODEL.
        principal: env.OPENAI_MODELO_CONVERSA ?? MODELO_OPENAI_CONVERSA,
        reserva: env.OPENAI_MODELO_CONVERSA_RESERVA ?? MODELO_OPENAI_PADRAO,
      };
    }
    return {
      principal: env.OPENAI_MODEL ?? MODELO_OPENAI_PADRAO,
      reserva: env.OPENAI_MODEL_RESERVA ?? MODELO_OPENAI_RESERVA_PADRAO,
    };
  }
  // O caminho Anthropic é legado (só por `IA_PROVEDOR=anthropic`), e
  // `classificacao` cai na linha estruturada de propósito: mudar o modelo dele
  // aqui seria alterar em silêncio um comportamento que ninguém pediu.
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
