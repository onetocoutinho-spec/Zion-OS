// O perfil de conteúdo da loja — leitura/escrita no NAVEGADOR (a tela de
// Configurações, sob RLS). A leitura do SERVIDOR, para os geradores, vive em
// `perfilDeConteudoNoServidor.ts`: este arquivo importa o cliente do
// navegador e não pode ser carregado por uma rota.
//
// Tabela `perfis_de_conteudo` (migração 068). Uma linha por loja; ausente é
// perfil vazio, e perfil vazio não vira tom inventado.

import { getSupabase } from "@/lib/supabase/client";
import {
  COLUNAS_DO_PERFIL,
  normalizarPerfil,
  perfilDaLinha,
  type LinhaDoPerfil,
  type PerfilDeConteudo,
} from "@/modules/assistant/domain/perfilDeConteudo";

/** NAVEGADOR, sob RLS. */
export async function lerPerfilDeConteudo(clienteId: string): Promise<PerfilDeConteudo> {
  const { data, error } = await getSupabase()
    .from("perfis_de_conteudo")
    .select(COLUNAS_DO_PERFIL)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return perfilDaLinha(data as LinhaDoPerfil | null);
}

/** NAVEGADOR, sob RLS: a própria loja, a agência no escopo, a equipe. */
export async function salvarPerfilDeConteudo(clienteId: string, perfil: PerfilDeConteudo, usuarioId: string | null): Promise<void> {
  const p = normalizarPerfil(perfil);
  const { error } = await getSupabase().from("perfis_de_conteudo").upsert(
    {
      cliente_id: clienteId,
      tom: p.tom || null,
      publico: p.publico || null,
      palavras_preferidas: [...p.palavrasPreferidas],
      palavras_proibidas: [...p.palavrasProibidas],
      observacoes: p.observacoes || null,
      // `|| null` no texto e `?? null` no booleano, e a diferença importa:
      // `false` é uma DECISÃO da loja ("não embuto o frete") e precisa ser
      // gravada. `|| null` a transformaria em "não escolheu", que é outra coisa.
      garantia: p.garantia || null,
      frete_gratis: p.freteGratis ?? null,
      atualizado_em: new Date().toISOString(),
      atualizado_por: usuarioId,
    },
    { onConflict: "cliente_id" }
  );
  if (error) throw new Error(error.message);
}
