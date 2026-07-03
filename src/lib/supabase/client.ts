// Cliente Supabase para uso no frontend.
//
// Usa apenas a URL pública e a chave anônima (anon key), que são seguras para
// o navegador desde que o RLS esteja ativo (database/supabase-rls.sql).
// A chave service_role NUNCA deve ser usada aqui.
//
// Se as variáveis não estiverem configuradas, o sistema inteiro cai para o
// modo demonstração com localStorage (ver src/lib/repositorio.ts).

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true quando o .env.local aponta para um projeto Supabase. */
export const supabaseConfigurado = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase não configurado. Preencha NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no .env.local."
    );
  }
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}
