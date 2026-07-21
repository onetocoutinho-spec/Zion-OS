// Acesso ao canal de marketplace NO SERVIDOR (R3).
//
// O refresh_token do Mercado Livre NUNCA deve trafegar pelo navegador. Estas
// funções leem/gravam o token usando o cliente Supabase COM O TOKEN DO USUÁRIO
// (vindo de serverAuthorization), então o RLS garante que:
//   * a equipe acessa qualquer canal (equipe_total, migração 009);
//   * o cliente acessa só o próprio canal (cliente_escopo, migração 011).
//
// ⚠️ Server-only. Não importe em componentes do navegador.

import type { SupabaseClient } from "@supabase/supabase-js";

const PADRAO = "Mercado Livre";

/** Dados sensíveis do canal — existem SÓ no servidor. */
export interface CanalSecreto {
  refreshToken: string | null;
  sellerId: string | null;
  tipoAnuncio: string;
  ativo: boolean;
}

/** Lê o canal (incl. refresh_token) do cliente, respeitando o RLS. */
export async function lerCanalServidor(
  supabase: SupabaseClient,
  clienteId: string,
  marketplace = PADRAO
): Promise<CanalSecreto | null> {
  const { data, error } = await supabase
    .from("canais_marketplace")
    .select("refresh_token, seller_id, tipo_anuncio, ativo")
    .eq("cliente_id", clienteId)
    .eq("marketplace", marketplace)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    refreshToken: (data.refresh_token as string | null) ?? null,
    sellerId: (data.seller_id as string | null) ?? null,
    tipoAnuncio: (data.tipo_anuncio as string | null) ?? "Premium",
    ativo: (data.ativo as boolean | null) ?? true,
  };
}

/** Cria/atualiza o canal com o refresh_token (usado no connect OAuth). */
export async function salvarRefreshTokenServidor(
  supabase: SupabaseClient,
  clienteId: string,
  refreshToken: string,
  marketplace = PADRAO,
  extra: { sellerId?: string | null } = {}
): Promise<void> {
  const linha: Record<string, unknown> = {
    cliente_id: clienteId,
    marketplace,
    refresh_token: refreshToken,
    ativo: true,
    atualizado_em: new Date().toISOString(),
  };
  if (extra.sellerId != null) linha.seller_id = extra.sellerId;
  const { error } = await supabase
    .from("canais_marketplace")
    .upsert(linha, { onConflict: "cliente_id,marketplace" });
  if (error) throw new Error(error.message);
}

/** Persiste o refresh_token ROTACIONADO pelo ML após uma chamada. */
export async function atualizarRefreshTokenServidor(
  supabase: SupabaseClient,
  clienteId: string,
  refreshToken: string,
  marketplace = PADRAO
): Promise<void> {
  if (!refreshToken) return;
  const { error } = await supabase
    .from("canais_marketplace")
    .update({ refresh_token: refreshToken, atualizado_em: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .eq("marketplace", marketplace);
  if (error) throw new Error(error.message);
}
