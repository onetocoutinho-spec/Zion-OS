// O perfil de conteúdo da loja, lido no SERVIDOR — para os geradores de
// título e descrição. Tabela `perfis_de_conteudo` (068). ⚠️ Server-only.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  COLUNAS_DO_PERFIL,
  PERFIL_VAZIO,
  perfilDaLinha,
  type LinhaDoPerfil,
  type PerfilDeConteudo,
} from "@/modules/assistant/domain/perfilDeConteudo";

/** Com o tenant. Falha de banco = perfil vazio (e o log diz); perfil vazio não vira tom inventado. */
export async function perfilDeConteudoNoServidor(clienteId: string): Promise<PerfilDeConteudo> {
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("perfis_de_conteudo")
      .select(COLUNAS_DO_PERFIL)
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (error) {
      // 42P01: a 068 ainda não foi aplicada. Segue sem perfil, como antes.
      if (error.code !== "42P01") console.error("[perfil de conteúdo] falha ao ler:", error);
      return PERFIL_VAZIO;
    }
    return perfilDaLinha(data as LinhaDoPerfil | null);
  } catch (e) {
    console.error("[perfil de conteúdo] falha ao ler:", e);
    return PERFIL_VAZIO;
  }
}
