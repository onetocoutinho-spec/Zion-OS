// Perfil do usuário logado (equipe x cliente) + leituras read-only do Portal.
//
// Sem Supabase (modo demo) → sempre equipe (o portal é recurso do Supabase).
// A segurança real está nas políticas RLS e nas funções portal_* do banco
// (migração 005); aqui é só o consumo.

import { getSupabase, supabaseConfigurado } from "../supabase/client";

export interface Perfil {
  papel: "equipe" | "cliente";
  clienteId: string | null;
  nome: string;
}

const EQUIPE: Perfil = { papel: "equipe", clienteId: null, nome: "" };

/**
 * Perfil do usuário logado. NEGA POR PADRÃO (R1):
 *   * modo demo (sem Supabase)         -> equipe (não há login no demo)
 *   * sem sessão / sem perfil / inativo -> null (SEM ACESSO)
 *   * erro real de banco/rede           -> propaga (o AuthGate trata),
 *     NUNCA vira "equipe" silenciosamente.
 *
 * O corte de acesso de verdade é o RLS (migração 016); aqui é só a leitura
 * para a casca decidir qual portal mostrar (e barrar quem não tem perfil).
 */
export async function meuPerfil(): Promise<Perfil | null> {
  if (!supabaseConfigurado) return EQUIPE; // demo: sem Auth, tudo é equipe
  const sb = getSupabase();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return null; // não autenticado = sem acesso
  const { data, error } = await sb
    .from("perfis")
    .select("papel, cliente_id, nome, ativo")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error; // erro real sobe — não vira acesso indevido
  if (!data) return null; // sem perfil = SEM ACESSO (antes era equipe)
  if (data.ativo === false) return null; // perfil inativo = SEM ACESSO
  return {
    papel: data.papel === "cliente" ? "cliente" : "equipe",
    clienteId: (data.cliente_id as string | null) ?? null,
    nome: (data.nome as string | null) ?? "",
  };
}

/**
 * Resultado DETALHADO da carga do perfil, para o AuthGate distinguir os
 * estados (A-01): sem sessão × sem perfil × inativo × ok. **Lança** em erro
 * real (rede/banco) — o chamador classifica como "erro temporário", nunca
 * como "sem acesso". Não confunde falha com ausência de permissão.
 */
export type CargaPerfil =
  | { tipo: "sem_sessao" }
  | { tipo: "sem_perfil" }
  | { tipo: "inativo" }
  | { tipo: "ok"; perfil: Perfil };

export async function carregarPerfil(): Promise<CargaPerfil> {
  if (!supabaseConfigurado) return { tipo: "ok", perfil: EQUIPE }; // demo
  const sb = getSupabase();
  const { data: auth, error: erroAuth } = await sb.auth.getUser();
  if (erroAuth) throw erroAuth; // erro de auth (rede/servidor) → temporário
  if (!auth.user) return { tipo: "sem_sessao" }; // sessão ausente/expirada
  const { data, error } = await sb
    .from("perfis")
    .select("papel, cliente_id, nome, ativo")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error; // erro de banco → temporário (não "sem acesso")
  if (!data) return { tipo: "sem_perfil" };
  if (data.ativo === false) return { tipo: "inativo" };
  return {
    tipo: "ok",
    perfil: {
      papel: data.papel === "cliente" ? "cliente" : "equipe",
      clienteId: (data.cliente_id as string | null) ?? null,
      nome: (data.nome as string | null) ?? "",
    },
  };
}

// ---- Leituras do Portal (via funções portal_* do banco) ----

export interface PortalResumo {
  cliente: string | null;
  proximaAcao: string | null;
  totalProdutos: number;
  emProducao: number;
  aprovados: number;
  publicados: number;
}

export interface PortalAcao {
  tarefa: string;
  proxima_acao: string;
  status: string;
  prazo: string | null;
}

export interface PortalAnuncio {
  titulo: string;
  status: string;
  criado_em: string;
}

export async function portalResumo(): Promise<PortalResumo | null> {
  const { data } = await getSupabase().rpc("portal_resumo");
  return (data as PortalResumo) ?? null;
}

export async function portalProximasAcoes(): Promise<PortalAcao[]> {
  const { data } = await getSupabase().rpc("portal_proximas_acoes");
  return (data as PortalAcao[]) ?? [];
}

export async function portalAnuncios(): Promise<PortalAnuncio[]> {
  const { data } = await getSupabase().rpc("portal_anuncios");
  return (data as PortalAnuncio[]) ?? [];
}

// ---- Cota mensal da esteira (self-service) ----

export interface QuotaEsteira {
  limite: number;
  usado: number;
  restante: number;
}

export async function quotaEsteira(): Promise<QuotaEsteira> {
  if (!supabaseConfigurado) return { limite: 30, usado: 0, restante: 30 };
  try {
    const { data } = await getSupabase().rpc("quota_esteira");
    const limite = Number((data as { limite?: number })?.limite ?? 0);
    const usado = Number((data as { usado?: number })?.usado ?? 0);
    return { limite, usado, restante: Math.max(0, limite - usado) };
  } catch {
    return { limite: 0, usado: 0, restante: 0 };
  }
}
