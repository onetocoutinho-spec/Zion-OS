// Autoria das Decisions (E4.2.3) — quem está decidindo nesta sessão.
//
// A Decision é, por definição, uma escolha HUMANA (RFC-AIL-002 §3.2), e todos
// os Signal Producers rodam no navegador sob a sessão Supabase do usuário: o
// tipo de autor é sempre "humano" e o identificador canônico é o E-MAIL da
// sessão (legível nas explicações; estável), com fallback para o id do usuário.
// Em demo/testes (sem Supabase) devolve "" — exatamente o valor que as
// Decisions carregavam antes desta release (retrocompatibilidade total).
//
// NUNCA lança e não faz rede: getSession lê o cache local da sessão. Preencher
// a autoria jamais pode afetar o fluxo de negócio (fire-and-forget — mesma
// disciplina de capturarDecisao).

import { getSupabase, supabaseConfigurado } from "../supabase/client";

/** Extrator PURO da autoria de uma sessão — testável sem Supabase. */
export function autorDaSessao(
  sessao:
    | { user?: { email?: string | null; id?: string | null } | null }
    | null
    | undefined
): string {
  return sessao?.user?.email ?? sessao?.user?.id ?? "";
}

/** O autor da sessão atual ("" em demo, sem sessão ou sob qualquer falha). */
export async function autorAtual(): Promise<string> {
  if (!supabaseConfigurado) return "";
  try {
    const { data } = await getSupabase().auth.getSession();
    return autorDaSessao(data.session);
  } catch {
    return "";
  }
}
