// A INVESTIGAÇÃO — o trabalho que não cabe num turno.
//
// ===========================================================================
// POR QUE ISTO PRECISOU EXISTIR
// ===========================================================================
//
// Um turno tem seis passos e 45 segundos. "Quantos produtos estão sem peso?"
// cabe. "Descobre o que está errado nessa loja" não: são dez a vinte
// operações — achar o produto, achar os SKUs, achar os anúncios, ler o estado
// de cada um, comparar, diagnosticar, propor.
//
// A saída não é um turno maior (a plataforma mata a função, e um turno que
// morre no meio perde o que já descobriu). É a investigação atravessar
// turnos, guardando o que aprendeu — o mesmo movimento que `copilot_cadastros`
// faz pelo cadastro em conversa.
//
// ===========================================================================
// O QUE ESTE MÓDULO GUARDA
// ===========================================================================
//
// O teto de rodadas, o resumo que volta para o contexto do turno seguinte, e
// a regra que impede a investigação de virar um poço sem fundo de cota.
//
// E uma linha que ele não cruza: investigação só LÊ e ANOTA. Não existe
// "investigação que executa" — toda escrita continua passando por proposta e
// clique. Um plano que age sozinho porque estava escrito num plano é a
// definição do que este projeto inteiro evita.
//
// Puro.

/**
 * Quantas rodadas uma investigação pode gastar.
 *
 * Seis passos por rodada × 4 = até 24 operações, que cobre o pior caso que
 * medimos (o pedido da Papete Modare, com ~16 operações). O teto existe pelo
 * mesmo motivo que `MAXIMO_DE_PASSOS`: um laço sem fim não erra alto, erra
 * caro — e aqui cada rodada é um turno pago.
 */
export const MAXIMO_DE_RODADAS = 4;

/** Quantos achados entram no contexto da rodada seguinte. */
export const ACHADOS_NO_CONTEXTO = 8;

export type StatusDaInvestigacao = "aberta" | "concluida" | "abandonada";

export interface Achado {
  rodada: number;
  /** O que se descobriu, na palavra do modelo. */
  texto: string;
  /** As fontes consultadas naquela rodada. */
  ferramentas: readonly string[];
  em: string;
}

export interface Investigacao {
  id: string;
  clienteId: string;
  conversaId: string | null;
  pergunta: string;
  status: StatusDaInvestigacao;
  rodadas: number;
  achados: readonly Achado[];
  proximoPasso: string;
}

/** Ainda dá para continuar? Aberta e com rodada sobrando. */
export function podeContinuar(i: Investigacao | null): boolean {
  return Boolean(i) && i!.status === "aberta" && i!.rodadas < MAXIMO_DE_RODADAS;
}

/** Por que não dá para continuar. `null` quando dá. */
export function motivoDeParar(i: Investigacao | null): string | null {
  if (!i) return "não há investigação aberta";
  if (i.status === "concluida") return "esta investigação já foi concluída";
  if (i.status === "abandonada") return "esta investigação foi abandonada";
  if (i.rodadas >= MAXIMO_DE_RODADAS) return `esta investigação já gastou as ${MAXIMO_DE_RODADAS} rodadas`;
  return null;
}

/**
 * O texto que entra no prompt da rodada seguinte.
 *
 * Só os últimos achados: a investigação inteira cresceria sem limite dentro do
 * contexto, e é o começo — a pergunta — que precisa sobreviver, não cada passo
 * intermediário. Vazio quando não há investigação, e vazio NÃO vira "comece do
 * zero": quem decide isso é quem chama.
 */
export function resumoDaInvestigacao(i: Investigacao | null): string[] {
  if (!i || i.status !== "aberta") return [];
  const linhas = [
    `INVESTIGAÇÃO EM ANDAMENTO (rodada ${i.rodadas + 1} de ${MAXIMO_DE_RODADAS}).`,
    `O que se quer descobrir: ${i.pergunta}`,
  ];
  const recentes = i.achados.slice(-ACHADOS_NO_CONTEXTO);
  if (recentes.length > 0) {
    linhas.push("O QUE JÁ FOI DESCOBERTO (não repita estas consultas):");
    for (const a of recentes) {
      const fontes = a.ferramentas.length > 0 ? ` [consultou: ${a.ferramentas.join(", ")}]` : "";
      linhas.push(`- rodada ${a.rodada}: ${a.texto}${fontes}`);
    }
  }
  if (i.proximoPasso.trim()) linhas.push(`O QUE FALTA: ${i.proximoPasso.trim()}`);
  if (i.rodadas + 1 >= MAXIMO_DE_RODADAS) {
    linhas.push(
      "ESTA É A ÚLTIMA RODADA: conclua com o que tiver, diga o que não deu para apurar, e não abra frentes novas."
    );
  }
  return linhas;
}

/** Um achado novo, normalizado. Texto vazio não vira achado. */
export function montarAchado(
  rodada: number,
  texto: string,
  ferramentas: readonly string[],
  agoraISO: string
): Achado | null {
  const t = texto.trim();
  if (!t) return null;
  return {
    rodada,
    texto: t.slice(0, 2000),
    // Sem repetir: a mesma ferramenta chamada três vezes na rodada é uma fonte.
    ferramentas: [...new Set(ferramentas)],
    em: agoraISO,
  };
}

/**
 * O que a tela mostra quando a rodada acaba e a investigação continua.
 *
 * A frase é do domínio, e não do modelo, por um motivo medido: o que promete
 * continuidade precisa ser verdade sobre o ESTADO, não sobre a intenção de
 * quem escreveu a frase.
 */
export function frasePendente(i: Investigacao): string {
  const faltam = MAXIMO_DE_RODADAS - i.rodadas;
  if (faltam <= 0) {
    return `Gastei as ${MAXIMO_DE_RODADAS} rodadas desta investigação. O que apurei está acima — se quiser seguir, me diga por onde.`;
  }
  return `Ainda não terminei de investigar. Anotei o que descobri até aqui; é só me dizer "continua" que eu sigo de onde parei.`;
}

/** A leitura das linhas cruas do banco. Formato ruim vira lista vazia. */
export function lerAchados(bruto: unknown): Achado[] {
  if (!Array.isArray(bruto)) return [];
  const saida: Achado[] = [];
  for (const item of bruto) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.texto !== "string" || !o.texto.trim()) continue;
    saida.push({
      rodada: typeof o.rodada === "number" ? o.rodada : 0,
      texto: o.texto,
      ferramentas: Array.isArray(o.ferramentas) ? o.ferramentas.filter((f): f is string => typeof f === "string") : [],
      em: typeof o.em === "string" ? o.em : "",
    });
  }
  return saida;
}
