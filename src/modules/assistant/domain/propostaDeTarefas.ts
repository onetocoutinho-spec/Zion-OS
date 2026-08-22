// "CRIA AS TAREFAS" — a lista que a loja decide fazer, proposta pelo Copilot
// a partir de um diagnóstico e gravada só no clique.
//
// Puro: a forma da lista, a validação do que o modelo mandou (teto, campos,
// prioridade) e a serialização para `copilot_propostas.texto`. Ver a decisão
// de produto na migração 069: é `tarefas_da_loja`, não `tarefas`.

export type Prioridade = "alta" | "media" | "baixa";

export interface TarefaProposta {
  titulo: string;
  /** O fato que a motivou — "sumiu das vendas nos últimos 30 dias". */
  motivo: string;
  prioridade: Prioridade;
  produtoId?: string;
}

export const MAXIMO_DE_TAREFAS = 10;
const MAXIMO_DO_TITULO = 140;
const MAXIMO_DO_MOTIVO = 300;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O que o modelo mandou, limpo. Tarefa sem título some; prioridade fora da
 * lista vira `media`; `produtoId` que não é UUID some (o modelo não escolhe
 * alvo por texto livre). Mais de dez: corta e avisa.
 */
export function normalizarTarefas(bruto: unknown): { tarefas: TarefaProposta[]; cortadas: number } {
  const lista = Array.isArray(bruto) ? bruto : [];
  const tarefas: TarefaProposta[] = [];
  for (const item of lista) {
    const t = item as Record<string, unknown>;
    const titulo = typeof t?.titulo === "string" ? t.titulo.trim().slice(0, MAXIMO_DO_TITULO) : "";
    if (!titulo) continue;
    const motivo = typeof t.motivo === "string" ? t.motivo.trim().slice(0, MAXIMO_DO_MOTIVO) : "";
    const prioridade: Prioridade =
      t.prioridade === "alta" || t.prioridade === "baixa" || t.prioridade === "media" ? t.prioridade : "media";
    const produtoId = typeof t.produtoId === "string" && UUID.test(t.produtoId) ? t.produtoId : undefined;
    tarefas.push({ titulo, motivo, prioridade, ...(produtoId ? { produtoId } : {}) });
  }
  const cortadas = Math.max(0, tarefas.length - MAXIMO_DE_TAREFAS);
  return { tarefas: tarefas.slice(0, MAXIMO_DE_TAREFAS), cortadas };
}

export function congelarTarefas(tarefas: readonly TarefaProposta[]): string {
  return JSON.stringify({ versao: 1, tarefas });
}

/** `null` quando o texto não é uma lista congelada — nunca uma lista inventada. */
export function lerTarefasCongeladas(texto: string | null | undefined): TarefaProposta[] | null {
  if (!texto) return null;
  try {
    const p = JSON.parse(texto) as { versao?: number; tarefas?: unknown };
    if (p?.versao !== 1) return null;
    const { tarefas } = normalizarTarefas(p.tarefas);
    return tarefas.length > 0 ? tarefas : null;
  } catch {
    return null;
  }
}

export function resumoDasTarefas(tarefas: readonly TarefaProposta[]): string {
  const n = tarefas.length;
  return `Criar ${n} tarefa${n === 1 ? "" : "s"}: ${tarefas.map((t) => t.titulo).join("; ")}`.slice(0, 500);
}
