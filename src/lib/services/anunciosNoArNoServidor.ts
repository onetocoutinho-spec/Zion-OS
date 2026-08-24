// OS ANÚNCIOS DA LOJA no marketplace, lidos no SERVIDOR. ⚠️ Server-only.
//
// A leitura é do BANCO, não do Mercado Livre — e isso é uma escolha, não uma
// economia disfarçada:
//
//   1. São ~800 anúncios nesta loja. Reler todos no ML dentro de um turno de
//      chat não cabe no orçamento de 45s do laço, e um turno que estoura é
//      pior que um número com data.
//   2. O estado JÁ foi medido e guardado (050/051), com a data. Então dá para
//      responder a verdade inteira: "489 no ar, medidos há 10 dias".
//
// O que este serviço nunca faz é esconder a idade. Quem lê a saída sabe quando
// ela foi medida, e a ferramenta manda dizer isso quando a leitura envelhece.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { lerTudoPaginado } from "@/lib/supabase/paginado";
import { retratoDosAnuncios, type AnuncioLido, type RetratoDosAnuncios } from "@/modules/publication/domain/anunciosNoAr";

interface LinhaDoBanco {
  ml_item_id: string | null;
  ml_permalink: string | null;
  status_marketplace: string | null;
  status_marketplace_em: string | null;
  sub_status_marketplace: string[] | null;
  produto: string | null;
  anuncio: { titulo?: string | null } | null;
}

/**
 * O título que a lojista reconhece: o do anúncio, e o nome do produto quando o
 * anúncio não tem título. Nunca o MLB sozinho — ele não diz nada a ninguém.
 */
function tituloDaLinha(l: LinhaDoBanco): string {
  const doAnuncio = typeof l.anuncio?.titulo === "string" ? l.anuncio.titulo.trim() : "";
  return doAnuncio || (l.produto ?? "").trim() || (l.ml_item_id ?? "sem título");
}

/** O retrato dos anúncios de UMA loja. O tenant é da sessão, nunca do corpo. */
export async function anunciosNoArNoServidor(clienteId: string): Promise<RetratoDosAnuncios> {
  const admin = getSupabaseAdmin();
  const linhas = await lerTudoPaginado<LinhaDoBanco>("anúncios no marketplace", (de, ate) =>
    admin
      .from("anuncios_gerados")
      .select("ml_item_id, ml_permalink, status_marketplace, status_marketplace_em, sub_status_marketplace, produto, anuncio")
      .eq("cliente_id", clienteId)
      .not("ml_item_id", "is", null)
      .order("id", { ascending: true })
      .range(de, ate)
  );

  const lidos: AnuncioLido[] = linhas.map((l) => ({
    mlItemId: l.ml_item_id,
    titulo: tituloDaLinha(l),
    permalink: l.ml_permalink,
    statusMarketplace: l.status_marketplace,
    statusMarketplaceEm: l.status_marketplace_em,
    subStatusMarketplace: l.sub_status_marketplace,
  }));

  return retratoDosAnuncios(lidos);
}
