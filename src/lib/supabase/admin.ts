// Cliente Supabase de SERVIDOR (service_role) — ignora RLS.
//
// ⚠️ NUNCA importe este arquivo em código que roda no navegador. A chave
// SUPABASE_SERVICE_ROLE_KEY é secreta e só existe no ambiente do servidor
// (sem prefixo NEXT_PUBLIC_). Usado pelo worker do cron, que não tem sessão
// de usuário e precisa escrever direto (fila + anúncios).

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let admin: SupabaseClient | null = null;

export function adminConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin não configurado — defina SUPABASE_SERVICE_ROLE_KEY (server-only) na Vercel."
    );
  }
  admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return admin;
}
