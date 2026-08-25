// A cota de IA, cobrada no SERVIDOR — ZION-QUOTA-001 / ZION-COST-001.
//
// Toda rota que faz uma chamada paga ao provedor passa por `cobrarCota` ANTES
// de chamar o provedor. A reserva é atômica no banco (`reservar_cota_ia`,
// migração 060): dois pedidos simultâneos no último crédito não passam os
// dois.
//
// QUEM TEM COTA: só quem tem `cliente_id` — o lojista. Equipe e agência não
// têm loja própria e seguem sem cota, que é o que já valia antes. Isso NÃO
// é brecha: esses papéis são criados pela equipe, não pelo cadastro aberto.
// O finding era a conta que qualquer um cria sozinho em dois passos.
//
// FALHA FECHADA: se a reserva der erro (banco fora, função ausente porque a
// 060 não foi aplicada), a resposta é NEGAR com 503, não liberar. Uma
// chamada de IA a menos se resolve tentando de novo; uma cota que "não
// conseguiu conferir e deixou passar" é o finding de volta.
//
// ⚠️ Server-only.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextoAutorizado } from "@/lib/auth/serverAuthorization";

// `chat` é um turno do fio de conversa (/api/assistente/conversa) — até seis
// passos de modelo por turno, a chamada mais cara do produto. `intencao` é a
// classificação de uma frase (/api/assistente), barata mas também paga.
// As duas ficaram FORA da cota quando a 060 nasceu: o ZION-COST-001 seguia
// aberto na porta principal.
export type TipoDeConsumo = "esteira" | "agente" | "catalogo" | "chat" | "intencao" | "imagem";

export type ResultadoCota =
  | { ok: true; limite: number | null; usado: number | null }
  | { ok: false; status: 429 | 503; motivo: string; limite?: number; usado?: number };

/** O que o banco devolve de `reservar_cota_ia`. */
export interface RespostaReserva {
  ok: boolean;
  motivo?: string;
  limite?: number;
  usado?: number;
}

/** A porta para o banco — injetável nos testes. */
export type Reservar = (params: {
  clienteId: string;
  tipo: TipoDeConsumo;
  creditos: number;
  usuarioId: string | null;
}) => Promise<RespostaReserva>;

/**
 * A decisão PURA, dado o perfil e a resposta da reserva. Testável sem rede.
 *
 * `reserva` é `null` quando ninguém perguntou ao banco — o que só acontece
 * quando o perfil não tem `cliente_id` (sem cota) ou quando a pergunta falhou.
 */
export function decidirCota(params: {
  clienteId: string | null;
  reserva: RespostaReserva | null;
  falhou: boolean;
}): ResultadoCota {
  const { clienteId, reserva, falhou } = params;
  if (!clienteId) return { ok: true, limite: null, usado: null }; // equipe / agência
  if (falhou || !reserva) {
    return { ok: false, status: 503, motivo: "Não foi possível conferir sua cota agora. Tente de novo em instantes." };
  }
  if (reserva.ok) return { ok: true, limite: reserva.limite ?? null, usado: reserva.usado ?? null };
  // 063: o minuto fecha antes do mês. Não gasta crédito; é só esperar.
  if (reserva.motivo === "ritmo") {
    return {
      ok: false,
      status: 429,
      motivo: "Muitas chamadas seguidas. Espere um minuto e tente de novo.",
      limite: reserva.limite,
      usado: reserva.usado,
    };
  }
  if (reserva.motivo === "cota_esgotada") {
    return {
      ok: false,
      status: 429,
      motivo: `Cota mensal de IA esgotada (${reserva.usado ?? "?"}/${reserva.limite ?? "?"}). Ela renova no início do próximo mês.`,
      limite: reserva.limite,
      usado: reserva.usado,
    };
  }
  // sem_cliente / cliente_inexistente: o perfil aponta para uma loja que o
  // banco não reconhece. Não é "sem cota" — é algo errado, e fecha.
  return { ok: false, status: 503, motivo: "Loja não encontrada para cobrar a cota." };
}

/** A porta REAL: chama `reservar_cota_ia` com o admin (service_role). */
export function reservaNoBanco(admin: SupabaseClient): Reservar {
  return async ({ clienteId, tipo, creditos, usuarioId }) => {
    const { data, error } = await admin.rpc("reservar_cota_ia", {
      p_cliente_id: clienteId,
      p_tipo: tipo,
      p_creditos: creditos,
      p_usuario_id: usuarioId,
    });
    if (error) throw new Error(error.message);
    return (data ?? { ok: false, motivo: "resposta_vazia" }) as RespostaReserva;
  };
}

/**
 * Cobra `creditos` do tenant da sessão. Chame ANTES do provedor.
 *
 * @param ctx    o contexto que `exigirAutenticado` devolveu
 * @param reservar a porta — `reservaNoBanco(getSupabaseAdmin())` em produção
 */
export async function cobrarCota(
  ctx: Pick<ContextoAutorizado, "perfil" | "usuario">,
  tipo: TipoDeConsumo,
  reservar: Reservar,
  creditos = 1
): Promise<ResultadoCota> {
  const clienteId = ctx.perfil.clienteId;
  if (!clienteId) return decidirCota({ clienteId, reserva: null, falhou: false });
  try {
    const reserva = await reservar({ clienteId, tipo, creditos, usuarioId: ctx.usuario?.id ?? null });
    return decidirCota({ clienteId, reserva, falhou: false });
  } catch (e) {
    console.error("[cotaDeIA] reserva falhou", e);
    return decidirCota({ clienteId, reserva: null, falhou: true });
  }
}

/** Traduz uma recusa para a resposta HTTP. */
export function respostaCotaRecusada(r: Extract<ResultadoCota, { ok: false }>): Response {
  return Response.json(
    { erro: r.motivo, cota: r.limite != null ? { limite: r.limite, usado: r.usado } : undefined },
    { status: r.status }
  );
}
