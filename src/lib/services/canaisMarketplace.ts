// Canal de marketplace por cliente (Fase 3) — leitura/gestão no NAVEGADOR.
//
// ⚠️ Este módulo roda no navegador. Por isso ele NUNCA lê nem devolve o
// refresh_token (credencial). O token só é manipulado no servidor
// (src/lib/marketplaces/canalServidor.ts). Aqui expomos apenas os campos
// PÚBLICOS do canal (status/config) — o "conectado" é derivado de `ativo`.

import { getSupabase, supabaseConfigurado } from "../supabase/client";

/** Visão PÚBLICA do canal (sem credenciais) — segura para o navegador. */
export interface CanalMarketplace {
  id: string;
  clienteId: string;
  marketplace: string;
  sellerId: string | null;
  tipoAnuncio: string;
  /** true quando há conexão ativa (o token existe, mas fica só no servidor). */
  ativo: boolean;
}

interface CanalRowPublic {
  id: string;
  cliente_id: string;
  marketplace: string;
  seller_id: string | null;
  tipo_anuncio: string | null;
  ativo: boolean | null;
}

/** Colunas PÚBLICAS — nunca inclui refresh_token. */
const COLUNAS_PUBLICAS = "id, cliente_id, marketplace, seller_id, tipo_anuncio, ativo";

function paraApp(r: CanalRowPublic): CanalMarketplace {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    marketplace: r.marketplace ?? "Mercado Livre",
    sellerId: r.seller_id,
    tipoAnuncio: r.tipo_anuncio ?? "Premium",
    ativo: r.ativo ?? false,
  };
}

export async function buscarCanal(
  clienteId: string,
  marketplace = "Mercado Livre"
): Promise<CanalMarketplace | null> {
  if (!supabaseConfigurado || !clienteId) return null;
  const { data } = await getSupabase()
    .from("canais_marketplace")
    .select(COLUNAS_PUBLICAS)
    .eq("cliente_id", clienteId)
    .eq("marketplace", marketplace)
    .maybeSingle();
  return data ? paraApp(data as CanalRowPublic) : null;
}

/**
 * Cria/atualiza a CONFIG do canal (upsert por cliente_id + marketplace).
 *
 * NÃO recebe refresh_token: a conexão OAuth grava o token só no servidor
 * (/api/ml/conectar). Aqui tratamos apenas status/config: `ativo` (ex.:
 * desconectar) e `tipoAnuncio`. Ao desconectar, o refresh_token é limpo.
 */
export async function salvarCanal(dados: {
  clienteId: string;
  marketplace?: string;
  tipoAnuncio?: string;
  /** true/false para (re)ativar ou desconectar. Ao desconectar, o token é limpo. */
  ativo?: boolean;
}): Promise<CanalMarketplace | null> {
  if (!supabaseConfigurado) return null;
  const linha: Record<string, unknown> = {
    cliente_id: dados.clienteId,
    marketplace: dados.marketplace ?? "Mercado Livre",
    atualizado_em: new Date().toISOString(),
  };
  if (dados.tipoAnuncio !== undefined) linha.tipo_anuncio = dados.tipoAnuncio;
  if (dados.ativo !== undefined) {
    linha.ativo = dados.ativo;
    // Desconectar: limpa a credencial (não é exposição — está apagando).
    if (dados.ativo === false) linha.refresh_token = null;
  }

  const { data, error } = await getSupabase()
    .from("canais_marketplace")
    .upsert(linha, { onConflict: "cliente_id,marketplace" })
    .select(COLUNAS_PUBLICAS)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? paraApp(data as CanalRowPublic) : null;
}
