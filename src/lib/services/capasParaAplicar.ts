// As capas que já estão no acervo e ainda não foram para o anúncio.
//
// ===========================================================================
// POR QUE ESTA TELA EXISTE
// ===========================================================================
//
// 142 anúncios desta loja estão em `under_review` com `waiting_for_patch`, e o
// remédio que o Mercado Livre escreve é sempre o mesmo: "descumpre o tamanho
// mínimo, posição e proporção". A capa precisa ser quadrada com 1200 de lado.
//
// As fotos que servem já existem — vieram do catálogo do fabricante, foram
// quadradas por `quadrarCapa` e estão em `imagens_produto`. O que faltava era
// o CAMINHO para aplicá-las.
//
// `/api/ml/aplicar-capa` sempre soube fazer isso, com as regras que ela
// aprendeu apanhando: uma cor por vez, para no primeiro erro, e RELÊ depois de
// cada envio porque `200` do ML é "aceitei" e não "troquei". O que não existia
// era tela: o único gatilho era a lojista arrastar a foto no chat, uma a uma —
// e esse caminho nem enxerga o acervo, porque espera um arquivo do disco dela.
//
// ===========================================================================
// A TELA NÃO REIMPLEMENTA NADA, E ISSO É O PONTO
// ===========================================================================
//
// Ela chama a rota como ela é. Não copia a composição, não decide a ordem das
// fotos, não fala com o Mercado Livre. Uma segunda definição de "como se troca
// capa" divergiria da primeira no primeiro ajuste — e as nove sentinelas que
// guardam aquela rota vigiam o texto DELA, não o de um segundo lugar.
//
// ===========================================================================
// A MARCA QUE IDENTIFICA ESTAS FOTOS
// ===========================================================================
//
// `porAsCapasNoAcervo.mjs` grava `observacoes` como
// `"Catálogo da marca: <arquivo>"`. É por essa marca que a tela as encontra —
// não por tamanho, porque uma foto de 1200 pode ser da lojista e já estar no
// anúncio, e não por `tipo_imagem`, porque elas entram como Secundária (o
// banco garante UMA Principal por produto, e todos já têm a deles).

import { getSupabase, supabaseConfigurado } from "../supabase/client";
import { lerTudoPaginado } from "../supabase/paginado";


/** A marca que `porAsCapasNoAcervo` deixa. Ver o topo. */
export const MARCA_DO_CATALOGO = "Catálogo da marca:";

export interface CapaParaAplicar {
  imagemId: string;
  produtoId: string;
  produto: string;
  cor: string;
  url: string;
  largura: number | null;
  altura: number | null;
  /** Quantos anúncios deste produto o ML está segurando. */
  anunciosParados: number;
  /** O menor lado da capa que está no ar hoje, quando o ML informou. */
  capaAtual: string | null;
}

interface LinhaImagem {
  id: string;
  produto_id: string;
  url: string;
  cor: string | null;
  largura: number | null;
  altura: number | null;
  observacoes: string | null;
}
interface LinhaProduto {
  id: string;
  nome: string | null;
}
interface LinhaAnuncio {
  produto_id: string | null;
  status_marketplace: string | null;
  foto_capa_max_size: string | null;
}

/**
 * As capas do catálogo do fabricante que esperam aplicação.
 *
 * Devolve `[]` quando não há Supabase — a tela distingue vazio de falha pelo
 * `estado` do `useLiveQuery`, nunca pelo tamanho da lista. É a lição que a tela
 * de Pendências deixou escrita.
 */
export async function capasParaAplicar(clienteId: string): Promise<CapaParaAplicar[]> {
  if (!supabaseConfigurado || !clienteId) return [];
  const sb = getSupabase();

  const imagens = await lerTudoPaginado<LinhaImagem>("capas do catálogo", (de, ate) =>
    sb
      .from("imagens_produto")
      .select("id, produto_id, url, cor, largura, altura, observacoes")
      .eq("cliente_id", clienteId)
      .like("observacoes", `${MARCA_DO_CATALOGO}%`)
      .order("id", { ascending: true })
      .range(de, ate)
  );
  if (imagens.length === 0) return [];

  const produtos = await lerTudoPaginado<LinhaProduto>("produtos das capas", (de, ate) =>
    sb
      .from("produtos")
      .select("id, nome")
      .eq("cliente_id", clienteId)
      .in("id", [...new Set(imagens.map((i) => i.produto_id))])
      .order("id", { ascending: true })
      .range(de, ate)
  );
  const anuncios = await lerTudoPaginado<LinhaAnuncio>("anúncios parados", (de, ate) =>
    sb
      .from("anuncios_gerados")
      .select("produto_id, status_marketplace, foto_capa_max_size")
      .eq("cliente_id", clienteId)
      .eq("status_marketplace", "under_review")
      .order("id", { ascending: true })
      .range(de, ate)
  );

  const nomeDe = new Map(produtos.map((p) => [p.id, p.nome ?? "(sem nome)"]));
  const parados = new Map<string, LinhaAnuncio[]>();
  for (const a of anuncios) {
    if (!a.produto_id) continue;
    if (!parados.has(a.produto_id)) parados.set(a.produto_id, []);
    parados.get(a.produto_id)!.push(a);
  }

  return imagens
    .map((i) => {
      const meus = parados.get(i.produto_id) ?? [];
      // O MENOR lado, e não o primeiro que aparecer: é ele que o ML compara
      // com 1200, e mostrar o maior faria a capa parecer melhor do que é.
      const menores = meus
        .map((a) => /(\d+)x(\d+)/.exec(a.foto_capa_max_size ?? ""))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => Math.min(Number(m[1]), Number(m[2])));
      return {
        imagemId: i.id,
        produtoId: i.produto_id,
        produto: nomeDe.get(i.produto_id) ?? "(sem nome)",
        cor: (i.cor ?? "").trim(),
        url: i.url,
        largura: i.largura,
        altura: i.altura,
        anunciosParados: meus.length,
        capaAtual: menores.length > 0 ? `${Math.min(...menores)}px no menor lado` : null,
      };
    })
    .sort((a, b) => b.anunciosParados - a.anunciosParados || a.produto.localeCompare(b.produto));
}

// ===========================================================================
// O ENVIO NÃO MORA AQUI, E ISSO FOI UMA CORREÇÃO
// ===========================================================================
//
// A primeira versão deste arquivo tinha um `aplicarCapa` que chamava
// `/api/ml/aplicar-capa` e interpretava a resposta. Era um SEGUNDO chamador da
// mesma rota, e um segundo lugar onde a resposta vira frase.
//
// `enviarCapaAoMercadoLivre` já existe e faz exatamente isso, com o comentário
// que explica por quê: "não interpreta a resposta — a frase que ela lê é
// composta em `desfechoDaFoto`, com teste, porque foi ali que este repositório
// mentiu três vezes".
//
// Então este módulo faz uma coisa só: dizer QUAIS capas esperam. Quem envia é
// quem já enviava.
