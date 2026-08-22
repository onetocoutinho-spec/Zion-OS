// Serviço de Agências — a entidade `agencias` (migração 054) lida pelo app.
//
// Até aqui a agência só existia no banco: nenhum tipo TS, nenhuma leitura.
// O header do painel precisa do NOME dela para o indicador "Agência ▸ Loja"
// (docs/product/ux/03 §Contexto global). A leitura respeita o RLS: a agência
// lê a própria (`agencia_le_a_propria`), a equipe lê todas (`equipe_total`).

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerTudoPaginado } from "../supabase/paginado";

export interface Agencia {
  id: string;
  nome: string;
  ativo: boolean;
}

export async function buscarAgencia(id: string): Promise<Agencia | null> {
  if (!supabaseConfigurado) return null; // demo: a equipe Zion não tem agência
  const { data, error } = await getSupabase()
    .from("agencias")
    .select("id, nome, ativo")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id as string, nome: data.nome as string, ativo: data.ativo !== false };
}

export async function listarAgencias(): Promise<Agencia[]> {
  if (!supabaseConfigurado) return [];
  const linhas = await lerTudoPaginado<{ id: string; nome: string; ativo: boolean | null }>("agencias", (de, ate) =>
    getSupabase().from("agencias").select("id, nome, ativo").order("nome").range(de, ate)
  );
  return linhas.map((a) => ({
    id: a.id as string,
    nome: a.nome as string,
    ativo: a.ativo !== false,
  }));
}
