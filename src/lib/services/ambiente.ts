// Pergunta ao banco em qual ambiente ele é.
//
// A regra de o que fazer com a resposta mora em
// `modules/portal/domain/faixaDeAmbiente` — aqui só a ida ao banco.
//
// ===========================================================================
// UMA VEZ POR ABA
// ===========================================================================
//
// O ambiente de um deploy não muda no meio da sessão: ou esta aba fala com o
// banco de teste ou fala com o de produção, e isso está decidido antes de a
// primeira tela abrir. Então a promessa é guardada e reaproveitada — sem isso
// cada troca de tela pagaria uma consulta para saber algo que já se sabe.
//
// ===========================================================================
// FALHAR É UMA RESPOSTA VÁLIDA
// ===========================================================================
//
// Em produção a tabela `environment_metadata` NÃO EXISTE, e o PostgREST
// responde erro. Isso não é defeito: é a resposta. Erro, tabela ausente e linha
// vazia viram `null`, e `faixaDeAmbiente` lê `null` como produção.
//
// Por isso nada aqui lança, e nada aqui loga em vermelho: o caminho de erro é o
// caminho comum.

import { getSupabase, supabaseConfigurado } from "@/lib/supabase/client";
import type { MarcaDeAmbiente } from "@/modules/portal/domain/faixaDeAmbiente";

let emCurso: Promise<MarcaDeAmbiente> | null = null;

async function perguntar(): Promise<MarcaDeAmbiente> {
  if (!supabaseConfigurado) return null;
  try {
    const { data, error } = await getSupabase()
      .from("environment_metadata")
      .select("environment")
      .limit(1)
      .maybeSingle();
    if (error) return null;
    return (data as { environment?: string } | null)?.environment ?? null;
  } catch {
    return null;
  }
}

/** A marca do ambiente, ou `null` quando não há prova. Nunca lança. */
export function lerMarcaDoAmbiente(): Promise<MarcaDeAmbiente> {
  emCurso ??= perguntar();
  return emCurso;
}

/** Só para teste: esquece o que já foi perguntado. */
export function esquecerAmbiente(): void {
  emCurso = null;
}
