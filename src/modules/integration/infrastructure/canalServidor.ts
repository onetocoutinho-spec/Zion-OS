// Acesso ao canal de marketplace NO SERVIDOR (R3).
//
// O refresh_token do Mercado Livre NUNCA deve trafegar pelo navegador — e,
// desde a migração 059, o papel `authenticated` não alcança a coluna nem por
// PostgREST: ela está fora do GRANT. Consequência: estas funções PRECISAM do
// cliente `service_role` (`clienteDaCredencial()`); com o token do usuário a
// leitura volta vazia e a escrita falha com "permission denied for column".
//
// A AUTORIZAÇÃO NÃO MORA AQUI. Quem decide se a sessão alcança `clienteId` é
// `exigirAcessoAoCliente` na rota, ANTES de chamar isto. Este módulo
// pressupõe que a pergunta já foi feita e respondida — é a mesma divisão de
// trabalho que `avaliarAcesso` descreve para todo caminho com service_role:
// "aqui é a única parede". Não chame estas funções com um `clienteId` que
// não veio de um contexto autorizado.
//
// ⚠️ Server-only. Não importe em componentes do navegador.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * O cliente que alcança a credencial. É o admin (service_role), porque é o
 * único papel com GRANT na coluna `refresh_token` depois da 059.
 *
 * Função, e não constante, para que os testes injetem o próprio cliente sem
 * precisar de SUPABASE_SERVICE_ROLE_KEY no ambiente.
 */
export function clienteDaCredencial(): SupabaseClient {
  return getSupabaseAdmin();
}

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

/**
 * Desconecta o canal: apaga a credencial e marca inativo.
 *
 * Vivia no navegador (`salvarCanal({ ativo: false })` gravava `refresh_token:
 * null` direto). Depois da 059 o navegador nao tem GRANT de escrita na coluna,
 * entao o apagamento vem para ca. Apagar e menos que ler — mas e a mesma
 * coluna, e a regra e uma so: o navegador nao toca nela.
 */
export async function limparCredencialServidor(
  supabase: SupabaseClient,
  clienteId: string,
  marketplace = PADRAO
): Promise<void> {
  const { error } = await supabase
    .from("canais_marketplace")
    .update({ refresh_token: null, ativo: false, atualizado_em: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .eq("marketplace", marketplace);
  if (error) throw new Error(error.message);
}
