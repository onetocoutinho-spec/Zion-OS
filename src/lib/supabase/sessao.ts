// Cabeçalho de autenticação para chamadas às rotas de servidor (/api/*).
//
// O Supabase roda no navegador (a sessão vive aqui). Para o servidor poder
// AUTORIZAR (ver src/lib/auth/serverAuthorization.ts), enviamos o access_token
// do usuário no header Authorization. Em modo demo (sem Supabase) não há token
// e as rotas liberam o acesso (fail-open só no demo).

import { getSupabase, supabaseConfigurado } from "./client";

/** { Authorization: "Bearer <jwt>" } quando há sessão; {} caso contrário. */
export async function cabecalhoAutenticacao(): Promise<Record<string, string>> {
  if (!supabaseConfigurado) return {};
  try {
    const { data } = await getSupabase().auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}
