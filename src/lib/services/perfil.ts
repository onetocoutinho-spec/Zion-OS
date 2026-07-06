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

export async function meuPerfil(): Promise<Perfil> {
  if (!supabaseConfigurado) return EQUIPE;
  // Qualquer falha (sessão inválida, tabela perfis inexistente, rede) NUNCA
  // pode travar o app — cai para equipe (fail-safe).
  try {
    const sb = getSupabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return EQUIPE;
    const { data } = await sb
      .from("perfis")
      .select("papel, cliente_id, nome")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (!data) return EQUIPE; // sem perfil = equipe (fail-safe)
    return {
      papel: data.papel === "cliente" ? "cliente" : "equipe",
      clienteId: (data.cliente_id as string | null) ?? null,
      nome: (data.nome as string | null) ?? "",
    };
  } catch {
    return EQUIPE;
  }
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
