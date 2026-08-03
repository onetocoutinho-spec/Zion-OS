// As infrações da conta, GRAVADAS — migração 052.
//
// Até 03/08/2026 a leitura de `/moderations/infractions/{userId}` vivia na
// memória da aba e sumia num F5. Medido naquele dia, na conta real: **1.060
// infrações em 460 anúncios distintos**, de uma conta com 781 — 59% do catálogo
// punido, e 904 das 1.060 por foto.
//
// Sem gravar, é impossível dizer "ontem eram 460, hoje são 430" — e essa é a
// única frase que prova trabalho feito.

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import type { Infracao } from "../../modules/integration/domain/infracoesDaConta";

export interface InfracaoRegistro extends Infracao {
  clienteId: string;
  marketplace: string;
  /** O idioma que VEIO, não o que pedimos. Medido: `language=PT` não é honrado. */
  idioma: string;
  /** Quando NÓS lemos — diferente de `dataCriacao`, que é quando o ML puniu. */
  lidaEm: string;
}

/**
 * Grava o que a leitura viu, sem duplicar.
 *
 * `ignoreDuplicates` porque a chave é `(cliente_id, infracao_id)` e o id vem do
 * ML: reler a conta é seguro e não reescreve nada. Isso importa mais do que
 * parece — a leitura completa são 53 páginas, e ela vai ser refeita muitas
 * vezes enquanto as 460 forem sendo resolvidas.
 *
 * NÃO apaga o que sumiu da resposta do ML. Infração que deixa de ser listada
 * não é infração que deixou de existir: pode ser página que falhou, filtro
 * diferente, ou anúncio removido da conta. Apagar por ausência foi o defeito
 * que a 051 evitou de propósito no estado do marketplace — ausência não é
 * encerramento.
 */
export async function gravarInfracoes(
  registros: readonly InfracaoRegistro[]
): Promise<{ gravadas: number; falharam: number }> {
  if (registros.length === 0) return { gravadas: 0, falharam: 0 };
  if (!supabaseConfigurado) return { gravadas: 0, falharam: 0 };

  const linhas = registros.map((r) => ({
    cliente_id: r.clienteId,
    marketplace: r.marketplace,
    infracao_id: r.id,
    // Data vazia vira NULL, não "hoje". Inventar data criaria uma linha do
    // tempo que ninguém observou.
    data_criacao: r.dataCriacao || null,
    element_id: r.elementoId || null,
    element_type: r.tipoElemento || null,
    // NULL quando o elemento moderado não é um anúncio — medido: um
    // `element_id` voltou como hash, não como MLB.
    related_item_id: r.itemRelacionado || null,
    filter_subgroup: r.subgrupo || null,
    // Verbatim, inclusive o HTML do `remedy`. A limpeza é decisão de exibição
    // (`semHtml`), não de armazenamento — guardar limpo seria guardar a NOSSA
    // interpretação da palavra do ML.
    motivo: r.motivo || null,
    remedio: r.remedio || null,
    idioma: r.idioma || null,
    lida_em: r.lidaEm,
  }));

  // Em lotes, e cada lote sobrevive à falha do outro.
  //
  // 1.060 linhas numa requisição só é justamente o tamanho que já produziu
  // `TypeError: Failed to fetch` nesta base. E engolir a falha do lote com a
  // contagem VISÍVEL é melhor que derrubar a gravação inteira: o segundo clique
  // completa, porque a escrita é idempotente.
  const LOTE = 200;
  let gravadas = 0;
  let falharam = 0;
  for (let i = 0; i < linhas.length; i += LOTE) {
    const lote = linhas.slice(i, i + LOTE);
    try {
      const { error } = await getSupabase()
        .from("infracoes_marketplace")
        .upsert(lote, { onConflict: "cliente_id,infracao_id", ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      gravadas += lote.length;
    } catch {
      falharam += lote.length;
    }
  }
  return { gravadas, falharam };
}

/**
 * Quantas infrações e quantos ANÚNCIOS distintos estão gravados hoje.
 *
 * As duas contas juntas porque separá-las é o erro que a tela cometeu na
 * primeira leitura: "1.060" lido como "1.060 anúncios" quando são 460.
 */
export async function retratoDasInfracoes(
  clienteId: string
): Promise<{ infracoes: number; anuncios: number }> {
  if (!supabaseConfigurado) return { infracoes: 0, anuncios: 0 };
  const { data, error } = await getSupabase()
    .from("infracoes_marketplace")
    .select("related_item_id")
    .eq("cliente_id", clienteId);
  if (error) return { infracoes: 0, anuncios: 0 };
  const linhas = (data ?? []) as { related_item_id: string | null }[];
  const itens = new Set(linhas.map((l) => l.related_item_id).filter(Boolean));
  return { infracoes: linhas.length, anuncios: itens.size };
}
