// O REGISTRO de cada chamada paga à IA — `ia_execucoes` (migração 067).
//
// Uma linha por execução: chat (o turno inteiro, com os passos), intenção,
// agente, esteira, imagem. Com tenant, usuário, modelo, tokens, latência e o
// DESFECHO — inclusive erro e timeout. É o que responde "quanto custa um
// usuário por mês" e "a qualidade caiu porque o modelo mudou". Antes não
// havia resposta: só `copilot_mensagens.tokens` (a soma, sem modelo) e a
// cota (créditos, não gasto). (Auditoria do Copilot, 2026-08-22, P2.)
//
// NUNCA LANÇA. Perder o registro é ruim; derrubar a resposta por causa do
// registro é pior. Erro de banco vai para o console — e, se a 067 ainda não
// foi aplicada, a primeira linha de log diz isso com todas as letras.
//
// ⚠️ Server-only.

import { adminConfigurado, getSupabaseAdmin } from "@/lib/supabase/admin";

export type OrigemDaExecucao =
  | "chat"
  | "intencao"
  | "agente"
  | "esteira"
  | "imagem"
  | "titulo"
  | "descricao"
  | "palavras_chave"
  | "catalogo";

export type StatusDaExecucao = "ok" | "erro" | "timeout" | "parcial" | "recusado";

export interface ExecucaoDeIA {
  clienteId: string | null;
  usuarioId: string | null;
  conversaId?: string | null;
  origem: OrigemDaExecucao;
  provedor?: string | null;
  modelo?: string | null;
  ferramentas?: readonly string[];
  passos?: number | null;
  tokens?: {
    entrada?: number | null;
    saida?: number | null;
    cacheLidos?: number | null;
    cacheEscritos?: number | null;
    total?: number | null;
  } | null;
  ms: number;
  /**
   * Do `ms` acima, quanto foi gasto DENTRO das ferramentas.
   *
   * `ms - msEmFerramentas` é o tempo em modelo. Separados porque em
   * 24/08/2026 eu afirmei que a latência do chat é volume de saída, e o turno
   * seguinte desmentiu: 879 tokens em 22,2 s contra 1.175 em 20,5 s. A parcela
   * de ferramenta não cresce com o tamanho da resposta — desde hoje o
   * diagnóstico de agrupamento fala com o Mercado Livre — e sem separá-la as
   * duas explicações são indistinguíveis.
   */
  msEmFerramentas?: number | null;
  status: StatusDaExecucao;
  erro?: string | null;
  degradado?: boolean;
}

let avisouAusencia = false;
let avisouColunaAusente = false;

export async function registrarExecucaoIA(e: ExecucaoDeIA): Promise<void> {
  if (!adminConfigurado()) return;
  try {
    const linha = {
      cliente_id: e.clienteId,
      usuario_id: e.usuarioId,
      conversa_id: e.conversaId ?? null,
      origem: e.origem,
      provedor: e.provedor ?? null,
      modelo: e.modelo ?? null,
      ferramentas: e.ferramentas ? [...e.ferramentas] : [],
      passos: e.passos ?? null,
      tokens_entrada: e.tokens?.entrada ?? null,
      tokens_saida: e.tokens?.saida ?? null,
      tokens_cache_lidos: e.tokens?.cacheLidos ?? null,
      tokens_cache_escritos: e.tokens?.cacheEscritos ?? null,
      tokens_total: e.tokens?.total ?? null,
      ms: Math.max(0, Math.round(e.ms)),
      status: e.status,
      erro: e.erro ? String(e.erro).slice(0, 500) : null,
      degradado: e.degradado ?? false,
      ms_ferramentas: e.msEmFerramentas == null ? null : Math.max(0, Math.round(e.msEmFerramentas)),
    };
    let { error } = await getSupabaseAdmin().from("ia_execucoes").insert(linha);
    // 42703 = a coluna não existe (073 não aplicada). O INSERT INTEIRO é
    // recusado pelo PostgREST, então um campo novo cegaria o medidor por
    // completo — e um medidor que some é pior que um campo que falta. Tenta de
    // novo sem ele, uma vez, e avisa uma vez por processo.
    if (error?.code === "42703" && "ms_ferramentas" in linha) {
      if (!avisouColunaAusente) {
        avisouColunaAusente = true;
        console.error("[ia_execucoes] sem `ms_ferramentas` — aplique database/migrations/073-o-tempo-gasto-em-ferramenta.sql");
      }
      const { ms_ferramentas: _semAColuna, ...semOCampoNovo } = linha;
      ({ error } = await getSupabaseAdmin().from("ia_execucoes").insert(semOCampoNovo));
    }
    if (error) {
      // 42P01 = tabela não existe: a 067 não foi aplicada. Uma vez por
      // processo, com todas as letras — não a cada turno.
      if (error.code === "42P01") {
        if (!avisouAusencia) {
          avisouAusencia = true;
          console.error("[ia_execucoes] a tabela não existe — aplique database/migrations/067-as-execucoes-de-ia.sql");
        }
        return;
      }
      console.error("[ia_execucoes] falha ao registrar:", error);
    }
  } catch (err) {
    console.error("[ia_execucoes] falha ao registrar:", err);
  }
}

/** Um cronômetro por execução. `ms()` pode ser lido quantas vezes for preciso. */
export function cronometro(): { ms: () => number } {
  const t0 = Date.now();
  return { ms: () => Date.now() - t0 };
}
