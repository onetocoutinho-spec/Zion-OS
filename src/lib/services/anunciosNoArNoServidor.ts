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
import { filaDeCorrecao, type FilaDeCorrecao, type LinhaDaFila } from "@/modules/publication/domain/filaDeCorrecao";

interface LinhaDoBanco {
  produto_id: string | null;
  ml_item_id: string | null;
  ml_permalink: string | null;
  status_marketplace: string | null;
  status_marketplace_em: string | null;
  sub_status_marketplace: string[] | null;
  anuncio: { titulo?: string | null } | null;
  // O nome do produto vem EMBUTIDO, não de uma coluna `produto`.
  //
  // `anuncios_gerados` não tem essa coluna — quem tem é o TIPO de aplicação
  // (`AnuncioGeradoRegistro.produto`), que a recebe deste embed. Pedi a coluna
  // e o PostgREST recusou a consulta inteira; as três ferramentas de anúncio
  // nasceram quebradas e só falharam em produção. É o mesmo defeito de
  // 10/08/2026 (`criado_em` por `created_at`), no mesmo lugar.
  produtos: { nome: string } | null;
}

/**
 * O título que a lojista reconhece: o do anúncio, e o nome do produto quando o
 * anúncio não tem título. Nunca o MLB sozinho — ele não diz nada a ninguém.
 */
function tituloDaLinha(l: LinhaDoBanco): string {
  const doAnuncio = typeof l.anuncio?.titulo === "string" ? l.anuncio.titulo.trim() : "";
  return doAnuncio || (l.produtos?.nome ?? "").trim() || (l.ml_item_id ?? "sem título");
}

/**
 * A varredura dos anúncios de UMA loja — UM select para as duas perguntas.
 *
 * "Quantos estão no ar" e "o que fazer com os que não estão" leem exatamente as
 * mesmas linhas. Duas varreduras seriam dois pagamentos pela mesma leitura, e o
 * laço do chat memoiza esta função por turno.
 *
 * O tenant é da sessão, nunca do corpo.
 */
export async function varrerAnunciosDaLoja(clienteId: string): Promise<LinhaDaFila[]> {
  const admin = getSupabaseAdmin();
  const linhas = await lerTudoPaginado<LinhaDoBanco>("anúncios no marketplace", (de, ate) =>
    admin
      .from("anuncios_gerados")
      .select("produto_id, ml_item_id, ml_permalink, status_marketplace, status_marketplace_em, sub_status_marketplace, anuncio, produtos(nome)")
      .eq("cliente_id", clienteId)
      .not("ml_item_id", "is", null)
      .order("id", { ascending: true })
      .range(de, ate)
  );

  return linhas.map((l) => ({
    mlItemId: l.ml_item_id,
    titulo: tituloDaLinha(l),
    permalink: l.ml_permalink,
    statusMarketplace: l.status_marketplace,
    statusMarketplaceEm: l.status_marketplace_em,
    subStatusMarketplace: l.sub_status_marketplace,
    produto: l.produtos?.nome ?? null,
    produtoId: l.produto_id,
  }));
}

/** O retrato: quantos no ar, quantos em cada outro estado, e a idade da medição. */
export async function anunciosNoArNoServidor(clienteId: string): Promise<RetratoDosAnuncios> {
  return retratoDosAnuncios((await varrerAnunciosDaLoja(clienteId)) as AnuncioLido[]);
}

/** A fila de correção: os que NÃO estão no ar, agrupados pelo motivo do ML. */
export async function filaDeCorrecaoNoServidor(clienteId: string): Promise<FilaDeCorrecao> {
  return filaDeCorrecao(await varrerAnunciosDaLoja(clienteId));
}
