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
  status: StatusDaExecucao;
  erro?: string | null;
  degradado?: boolean;
}

let avisouAusencia = false;

export async function registrarExecucaoIA(e: ExecucaoDeIA): Promise<void> {
  if (!adminConfigurado()) return;
  try {
    const { error } = await getSupabaseAdmin().from("ia_execucoes").insert({
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
    });
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
