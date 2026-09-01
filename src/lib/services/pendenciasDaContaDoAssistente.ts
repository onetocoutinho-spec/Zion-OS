// A LEITURA, no servidor, do que o Mercado Livre disse sobre esta conta.
//
// ===========================================================================
// POR QUE ISTO EXISTE — medido em produção em 11/08/2026
// ===========================================================================
//
// Perguntado "o que o ML pede pra resolver?", o chat respondeu, com toda
// honestidade: "eu tenho a contagem, mas não tenho acesso ao conteúdo delas —
// não vejo qual remédio o Mercado Livre indicou". Era verdade: nenhuma das 22
// ferramentas lia `motivo`, `remedio` ou `filter_subgroup`.
//
// E o banco tinha, naquele instante: 1.066 infrações, 1.060 com motivo e
// 1.034 com o remédio ESCRITO PELO PRÓPRIO ML — FOTOS 560 em 400 anúncios
// ("descumpre o tamanho mínimo, posição e proporção"), PQT 362 em 327 ("tem
// logos e/ou textos"), DOMAIN 116 em 25 ("pausamos o anúncio… ajuste o
// título"). Mais 131 anúncios `paused`, 155 `under_review` e 12 `closed`,
// todos com MLB.
//
// A lojista tinha a receita do conserto guardada em casa e o assistente dizia
// não saber de nada.
//
// ===========================================================================
// NADA DE REGRA NOVA MORA AQUI
// ===========================================================================
//
// `pendenciasDaConta` já decide gravidade, tipo e o que fazer — inclusive o
// ramo grave de propriedade intelectual, onde editar-e-republicar conta como
// reincidência. `pendenciasDaMemoria` já é o ponto ÚNICO de montagem, usado
// pelas duas telas. Este arquivo só carrega e entrega: é uma porta.
//
// O que ele NÃO pode fazer é reusar `infracoesPorAnuncioDoCliente`: aquela
// função lê com o cliente do NAVEGADOR, e chamá-la aqui devolveria vazio em
// silêncio — o defeito exato que fez o ensaio de publicação dizer "FOTOS 0"
// num produto com dez fotos, em 11/08/2026.

import { getSupabaseAdmin } from "../supabase/admin";
import { lerTudoPaginado } from "../supabase/paginado";
import { semHtml } from "../../modules/integration/domain/infracoesDaConta";
import type { InfracoesPorAnuncio } from "../../modules/integration/domain/pendenciasDaConta";
import {
  pendenciasDaMemoria,
  type PendenciasDaMemoria,
} from "../client-portal/pendenciasDaMemoria";

/** As infrações por MLB, lidas com a credencial do SERVIDOR. */
async function infracoesDoCliente(clienteId: string): Promise<InfracoesPorAnuncio> {
  const linhas = await lerTudoPaginado<{
    related_item_id: string;
    motivo: string | null;
    remedio: string | null;
    filter_subgroup: string | null;
  }>("infrações do Mercado Livre (assistente)", (de, ate) =>
    getSupabaseAdmin()
      .from("infracoes_marketplace")
      .select("related_item_id, motivo, remedio, filter_subgroup")
      .eq("cliente_id", clienteId)
      .not("related_item_id", "is", null)
      .order("id", { ascending: true })
      .range(de, ate)
  ).catch(() => []);

  const porMlb: Record<
    string,
    { motivo: string; remedio: string; categoria: string }[]
  > = {};
  for (const l of linhas) {
    // `semHtml` porque o remédio chega em HTML do ML: `<strong>Corrija suas
    // fotos:</strong><ul><li>…`. A lojista lê texto, e o modelo também.
    const item = {
      motivo: semHtml(l.motivo ?? ""),
      remedio: semHtml(l.remedio ?? ""),
      categoria: l.filter_subgroup ?? "",
    };
    (porMlb[l.related_item_id] ??= []).push(item);
  }
  return porMlb;
}

/**
 * O retrato do que o ML disse — pronto para o assistente ler.
 *
 * `null` quando nenhum anúncio tem leitura gravada: sem leitura não há
 * retrato, e inventar um vazio diria "está tudo certo" sobre uma conta que
 * ninguém olhou. A distinção entre "não há" e "não lemos" é a mesma que o
 * caminho barato já faz com as infrações.
 */
export async function pendenciasDaContaDoCliente(
  clienteId: string
): Promise<PendenciasDaMemoria | null> {
  // `produto` NÃO é coluna de `anuncios_gerados` — o nome vem pelo embed de
  // `produtos`. Escrevi `produto` na primeira versão e conferi contra o
  // information_schema antes de ligar: é a família de defeito que já custou
  // dias nesta base (`criado_em` em vez de `created_at`,
  // `tabela_medidas_override` em vez de `tabela_medidas`), sempre igual —
  // PostgREST erra, o `.catch` engole, e o software afirma que não há nada.
  const anuncios = await lerTudoPaginado<{
    ml_item_id: string | null;
    produtos: { nome: string | null } | null;
    ml_permalink: string | null;
    status_marketplace: string | null;
    status_marketplace_em: string | null;
    estoque_marketplace: number | null;
    sub_status_marketplace: string[] | null;
    foto_capa_max_size: string | null;
    anuncio: { tituloOtimizado?: string } | null;
  }>("anúncios com leitura do ML (assistente)", (de, ate) =>
    getSupabaseAdmin()
      .from("anuncios_gerados")
      .select(
        "ml_item_id, produtos(nome), ml_permalink, status_marketplace, status_marketplace_em, estoque_marketplace, sub_status_marketplace, foto_capa_max_size, anuncio"
      )
      .eq("cliente_id", clienteId)
      .not("ml_item_id", "is", null)
      .not("status_marketplace", "is", null)
      .order("id", { ascending: true })
      .range(de, ate)
  ).catch(() => []);

  if (anuncios.length === 0) return null;

  const infracoes = await infracoesDoCliente(clienteId);

  return pendenciasDaMemoria(
    anuncios.map((a) => ({
      mlItemId: a.ml_item_id,
      produto: a.produtos?.nome ?? null,
      mlPermalink: a.ml_permalink,
      statusMarketplace: a.status_marketplace,
      statusMarketplaceEm: a.status_marketplace_em,
      estoqueMarketplace: a.estoque_marketplace,
      subStatusMarketplace: a.sub_status_marketplace,
      fotoCapaMaxSize: a.foto_capa_max_size,
      anuncio: a.anuncio ?? undefined,
    })) as never,
    infracoes
  );
}
