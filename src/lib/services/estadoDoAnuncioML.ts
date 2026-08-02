// Tirar do ar e devolver ao ar — a operação que faltava.
//
// ===========================================================================
// O QUE ISTO RESOLVE
// ===========================================================================
//
// 2026-08-01: a lojista publicou o Papete Modare e pediu para pausá-lo — as
// fotos estavam com a cor errada. O Zion não sabia pausar. Só sabia encerrar,
// que é TERMINAL: o anúncio sai do ar, não volta, e leva junto o histórico de
// relevância que acumulou.
//
// A única saída dentro do sistema era destruir o anúncio para corrigir uma
// foto. Ela foi ao painel do ML fazer à mão.
//
// ===========================================================================
// A ORDEM DAS DUAS ESCRITAS
// ===========================================================================
//
// O ML primeiro, o banco depois — e nunca o contrário.
//
// Gravar aqui antes faria o Zion afirmar "pausado" sobre um anúncio que talvez
// continue vendendo. Na ordem certa, uma falha de rede depois do ML deixa o
// banco desatualizado — e desatualizado é recuperável: a próxima importação
// lê o estado real e corrige. Uma afirmação falsa, não.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import { lerJson } from "../http/respostaJson";
import { atualizarAnuncioGerado } from "./anunciosGerados";
import type { AnuncioGeradoRegistro } from "../types";

export type EstadoDesejado = "paused" | "active";

export interface ResultadoEstadoNoML {
  /** O estado que o ML CONFIRMOU — pode não ser o que foi pedido. */
  status: string;
  /** `true` quando o ML devolveu algo diferente do pedido (ex.: under_review). */
  divergiu: boolean;
}

/**
 * Mostra o que aconteceu, incluindo quando o ML não obedeceu.
 *
 * Reativar um anúncio pode devolver `under_review`, porque o ML revisa antes de
 * recolocar na vitrine. Dizer "reativado" nesse caso seria mentira, e o
 * lojista descobriria sozinho olhando o painel.
 */
export function explicarEstado(pedido: EstadoDesejado, confirmado: string): string {
  const s = (confirmado ?? "").trim().toLowerCase();
  if (pedido === "paused") {
    return s === "paused"
      ? "Anúncio pausado — saiu da vitrine e o histórico foi mantido. Reative quando quiser."
      : `Pedi para pausar e o Mercado Livre devolveu "${confirmado}".`;
  }
  if (s === "active") return "Anúncio no ar de novo.";
  if (s === "under_review") {
    return "Pedido de reativação aceito — o Mercado Livre está revisando antes de recolocar na vitrine.";
  }
  return `Pedi para reativar e o Mercado Livre devolveu "${confirmado}".`;
}

/**
 * Muda o estado do anúncio no ML e grava o que o ML CONFIRMOU.
 *
 * Nunca grava o estado pedido: o ML pode responder `under_review` a uma
 * reativação, e fingir `active` plantaria no banco um estado que não é o real —
 * o mesmo defeito do `status: "publicado"` fixo que custou o dia de hoje.
 */
export async function definirEstadoNoML(
  registro: AnuncioGeradoRegistro,
  estado: EstadoDesejado
): Promise<ResultadoEstadoNoML> {
  const itemId = (registro.mlItemId ?? "").trim();
  if (!itemId) throw new Error("Este anúncio não tem um item no Mercado Livre.");

  const resposta = await fetch("/api/ml/estado-do-anuncio", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ clienteId: registro.clienteId, itemId, estado }),
  });
  const dados = await lerJson<{ status?: string; erro?: string }>(
    resposta,
    estado === "paused" ? "A pausa do anúncio" : "A reativação do anúncio"
  );
  if (!resposta.ok) throw new Error(dados.erro ?? "Falha ao mudar o estado do anúncio.");

  const confirmado = (dados.status ?? "").trim();
  if (confirmado) {
    await atualizarAnuncioGerado(registro.id, {
      statusMarketplace: confirmado,
      statusMarketplaceEm: new Date().toISOString(),
    });
  }
  return { status: confirmado, divergiu: confirmado !== estado };
}
