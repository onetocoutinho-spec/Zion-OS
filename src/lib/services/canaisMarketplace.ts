// Canal de marketplace por cliente (Fase 3) — conexão OAuth do cliente no ML.
//
// Guarda só o refresh_token + config do canal (o segredo do APP ML fica no
// .env do servidor). Recurso do Supabase e restrito à equipe (RLS). Em modo
// demo (sem Supabase) não há canal → a publicação fica só em dry-run.

import { getSupabase, supabaseConfigurado } from "../supabase/client";

export interface CanalMarketplace {
  id: string;
  clienteId: string;
  marketplace: string;
  refreshToken: string | null;
  sellerId: string | null;
  tipoAnuncio: string;
  ativo: boolean;
}

interface CanalRow {
  id: string;
  cliente_id: string;
  marketplace: string;
  refresh_token: string | null;
  seller_id: string | null;
  tipo_anuncio: string | null;
  ativo: boolean | null;
}

function paraApp(r: CanalRow): CanalMarketplace {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    marketplace: r.marketplace ?? "Mercado Livre",
    refreshToken: r.refresh_token,
    sellerId: r.seller_id,
    tipoAnuncio: r.tipo_anuncio ?? "Premium",
    ativo: r.ativo ?? true,
  };
}

export async function buscarCanal(
  clienteId: string,
  marketplace = "Mercado Livre"
): Promise<CanalMarketplace | null> {
  if (!supabaseConfigurado || !clienteId) return null;
  const { data } = await getSupabase()
    .from("canais_marketplace")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("marketplace", marketplace)
    .maybeSingle();
  return data ? paraApp(data as CanalRow) : null;
}

/** Cria/atualiza o canal do cliente (upsert por cliente_id + marketplace). */
export async function salvarCanal(dados: {
  clienteId: string;
  marketplace?: string;
  refreshToken?: string | null;
  sellerId?: string | null;
  tipoAnuncio?: string;
  ativo?: boolean;
}): Promise<CanalMarketplace | null> {
  if (!supabaseConfigurado) return null;
  const linha: Record<string, unknown> = {
    cliente_id: dados.clienteId,
    marketplace: dados.marketplace ?? "Mercado Livre",
    atualizado_em: new Date().toISOString(),
  };
  if (dados.refreshToken !== undefined) linha.refresh_token = dados.refreshToken;
  if (dados.sellerId !== undefined) linha.seller_id = dados.sellerId;
  if (dados.tipoAnuncio !== undefined) linha.tipo_anuncio = dados.tipoAnuncio;
  if (dados.ativo !== undefined) linha.ativo = dados.ativo;

  const { data, error } = await getSupabase()
    .from("canais_marketplace")
    .upsert(linha, { onConflict: "cliente_id,marketplace" })
    .select("*")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? paraApp(data as CanalRow) : null;
}

/** Persiste o refresh_token rotacionado pelo ML após uma publicação. */
export async function atualizarRefreshToken(
  clienteId: string,
  refreshToken: string,
  marketplace = "Mercado Livre"
): Promise<void> {
  if (!supabaseConfigurado || !refreshToken) return;
  await getSupabase()
    .from("canais_marketplace")
    .update({ refresh_token: refreshToken, atualizado_em: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .eq("marketplace", marketplace);
}
