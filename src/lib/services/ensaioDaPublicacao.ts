// O ENSAIO da publicação — o que subiria se ela publicasse AGORA.
//
// Vivia inline na rota de conversa. Saiu de lá em 2026-08-22 porque passou a
// ter DOIS leitores: a conversa (para mostrar o cartão e congelar o pedido na
// Proposal) e a confirmação (para refazer a impressão e comparar com a que a
// pessoa leu). Duas cópias divergiriam exatamente no dia em que importasse.
//
// O payload é o mesmo que a publicação real monta (`montarPreviewML`), porque
// mostrar um resumo feito à parte seria mostrar uma coisa e publicar outra.
//
// ⚠️ Server-only.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { montarPreviewML } from "@/lib/services/publicacaoML";
import { registroDoProduto, registroPorId } from "@/lib/services/preparacaoDeAnuncio";
import { montarBundleUserProducts } from "@/modules/publication/domain/composicaoConteudo";
import {
  impressaoDaPublicacao,
  type EnsaioDaPublicacao,
  type PedidoCongelado,
} from "@/modules/assistant/domain/propostaDePublicacao";
import type { AnuncioGeradoRegistro } from "@/lib/types";

/**
 * O ESTOQUE MORA EM DOIS LUGARES, e ler só um mostrava "—" para todo produto
 * com grade — que é a maioria de um catálogo de calçado.
 *
 * `montarItemML` põe `available_quantity` no TOPO só quando NÃO há variações;
 * com grade, cada variação carrega o seu. Somar é o que responde "quantas
 * peças vão para o ar". Uma função só: o ensaio mostrado e a impressão
 * congelada na Proposal precisam contar do mesmo jeito.
 */
export function estoqueDoPayload(payload: Record<string, unknown>): number | null {
  const vars = payload.variations;
  if (Array.isArray(vars) && vars.length > 0) {
    return vars.reduce(
      (t: number, v) =>
        t +
        (typeof (v as { available_quantity?: number }).available_quantity === "number"
          ? ((v as { available_quantity?: number }).available_quantity as number)
          : 0),
      0
    );
  }
  return typeof payload.available_quantity === "number" ? payload.available_quantity : null;
}

export interface EnsaioCompleto {
  anuncioId: string;
  nome: string;
  titulo: string;
  preco: number | null;
  estoque: number | null;
  fotos: number;
  categoria: string;
  /** Já publicado? Então não há o que publicar. */
  jaPublicado: boolean;
  mlItemId: string | null;
  congelado?: PedidoCongelado;
}

/** O ensaio de um REGISTRO já carregado. Lança se as fotos não puderem ser lidas. */
export async function ensaioDoRegistro(clienteDaSessao: string, reg: AnuncioGeradoRegistro): Promise<EnsaioCompleto> {
  // AS FOTOS PRECISAM ENTRAR AQUI.
  //
  // `montarPreviewML(reg)` sem opções passa `pictures: undefined` — só
  // `executarPublicacao` busca as URLs. O ensaio mostrava FOTOS 0 num
  // produto com dez, e um ensaio que mente sobre a foto é pior que
  // nenhum: ela confirmaria achando que o anúncio sobe com imagem.
  //
  // Medido em produção em 11/08/2026, no cartão da Sapatilha Modare — e
  // só apareceu porque o cartão mostra o zero em âmbar.
  // AS FOTOS, COM O CLIENTE DE SERVIDOR.
  //
  // `urlsDoProduto` usa `getSupabase()` — o cliente do NAVEGADOR. Chamado
  // daqui ele não tem sessão, a RLS recusa, e o resultado é uma lista
  // vazia indistinguível de "produto sem foto". Foi o segundo motivo de
  // o cartão mostrar FOTOS 0 num produto com dez.
  //
  // A REGRA continua sendo a de lá: "Pendente" fora (a lojista tirou do
  // envio) e a capa primeiro. Repeti-la aqui seria a segunda fonte que
  // este repositório passou o dia removendo — mas o serviço não é
  // chamável do servidor, então a regra vem em comentário e a sentinela
  // guarda as duas.
  let fotos: string[] = [];
  if (reg.produtoId) {
    try {
      const { data } = await getSupabaseAdmin()
        .from("imagens_produto")
        .select("url, tipo_imagem, status")
        .eq("produto_id", reg.produtoId);
      fotos = ((data ?? []) as { url: string; tipo_imagem?: string; status?: string }[])
        .filter((i) => i.status !== "Pendente")
        .sort((a, b) =>
          a.tipo_imagem === "Principal" ? -1 : b.tipo_imagem === "Principal" ? 1 : 0
        )
        .map((i) => i.url);
    } catch (e) {
      // Falhar aqui NÃO é "produto sem foto": é não saber. O cartão
      // mostraria 0 e ela publicaria achando que sobe sem imagem.
      console.error("[conversa] falha ao ler as fotos do ensaio:", e);
      throw e;
    }
  }
  const payload = montarPreviewML(reg, { pictures: fotos }) as Record<string, unknown>;
  const pics = payload.pictures;
  // O PEDIDO CONGELADO: o mesmo bundle User Products e os mesmos MLBs
  // conhecidos que `publicarNoML` montava no navegador no clique — só
  // que AGORA, e guardados na Proposal. O clique publica isto, não o que
  // o navegador releria depois.
  const bundle = montarBundleUserProducts(reg.anuncio, { pictures: fotos });
  const { data: irmaos } = await getSupabaseAdmin()
    .from("anuncios_gerados")
    .select("ml_item_id")
    .eq("cliente_id", clienteDaSessao)
    .eq("produto_id", reg.produtoId ?? "")
    .not("ml_item_id", "is", null);
  const mlbsDoProduto = ((irmaos ?? []) as { ml_item_id: string | null }[])
    .map((a) => a.ml_item_id)
    .filter((x): x is string => Boolean(x));
  const ensaioLido = {
    titulo: String(payload.title ?? ""),
    preco: typeof payload.price === "number" ? payload.price : null,
    estoque: estoqueDoPayload(payload),
    fotos: Array.isArray(pics) ? pics.length : 0,
    categoria: String(payload.category_id ?? ""),
  };
  const congelado: PedidoCongelado | undefined = reg.produtoId
    ? {
        versao: 1,
        anuncioId: reg.id,
        produtoId: reg.produtoId,
        nome: reg.produto ?? "",
        marketplace: reg.marketplace,
        payload,
        ...(bundle.ok ? { userProducts: bundle.bundle } : {}),
        mlbsDoProduto,
        ...(reg.anuncio?.tituloOtimizado ? { tituloParaCategoria: reg.anuncio.tituloOtimizado } : {}),
        ensaio: ensaioLido,
      }
    : undefined;
  return {
    anuncioId: reg.id,
    nome: reg.produto ?? "",
    titulo: String(payload.title ?? ""),
    preco: typeof payload.price === "number" ? payload.price : null,
    estoque: estoqueDoPayload(payload),
    fotos: Array.isArray(pics) ? pics.length : 0,
    categoria: String(payload.category_id ?? ""),
    jaPublicado: reg.status === "publicado" || !!reg.mlItemId,
    mlItemId: reg.mlItemId ?? null,
    ...(congelado ? { congelado } : {}),
  };
}

/** O ensaio do anúncio MAIS RECENTE de um produto. `null` sem anúncio preparado. */
export async function ensaioDoProduto(clienteId: string, produtoId: string): Promise<EnsaioCompleto | null> {
  const reg = await registroDoProduto(clienteId, produtoId);
  if (!reg) return null;
  return ensaioDoRegistro(clienteId, reg);
}

/**
 * A impressão do ensaio de UM anúncio, refeita agora — para a precondição da
 * Proposal de publicação. `null` quando o anúncio não existe (ou as fotos não
 * puderam ser lidas): `null` não casa com a impressão gravada, e a proposta
 * vira `obsoleta` em vez de publicar no escuro.
 */
export async function impressaoAtualDaPublicacao(clienteId: string, anuncioId: string): Promise<number | null> {
  const reg = await registroPorId(clienteId, anuncioId);
  if (!reg) return null;
  try {
    const e = await ensaioDoRegistro(clienteId, reg);
    const ensaio: EnsaioDaPublicacao = {
      titulo: e.titulo,
      preco: e.preco,
      estoque: e.estoque,
      fotos: e.fotos,
      categoria: e.categoria,
    };
    return impressaoDaPublicacao(ensaio);
  } catch {
    return null;
  }
}
