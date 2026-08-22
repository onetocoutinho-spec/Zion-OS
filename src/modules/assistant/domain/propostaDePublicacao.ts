// A PUBLICAÇÃO como Proposal — o que se congela e o que se confere.
//
// Até 2026-08-22 `propor_publicacao` mandava um cartão "sem Proposal
// persistida, de propósito": o clique relia o registro NO NAVEGADOR e chamava
// `/api/ml/publicar` com um payload montado ali. Três proteções que a Proposal
// existe para dar ficavam fora da única ação que o comprador vê:
//
//   - TOCTOU: o ensaio mostrado e o payload publicado eram duas leituras, em
//     momentos diferentes, por atores diferentes — título, preço ou estoque
//     podiam mudar entre o cartão e o clique;
//   - expiração: um cartão de ontem publicava hoje;
//   - idempotência de servidor: o "publicando…" era um boolean de React; duplo
//     clique em duas abas criava dois anúncios.
//
// Agora o ensaio é CONGELADO na Proposal (`texto` carrega o pedido inteiro:
// payload, bundle User Products, MLBs conhecidos), a precondição é a
// IMPRESSÃO do que a pessoa leu, e a execução publica a partir do que foi
// salvo — nunca do que o navegador mandar depois. (Auditoria do Copilot, P1.)
//
// Puro. Quem congela é a rota de conversa; quem descongela é a de proposta.

import type { BundleUserProducts } from "@/modules/publication/domain/composicaoConteudo";

/** A chave da precondição. Uma só: a impressão do ensaio inteiro. */
export const CAMPO_PUBLICACAO = "publicacao";

/** O que a pessoa LEU no cartão — e o que é conferido de novo no clique. */
export interface EnsaioDaPublicacao {
  titulo: string;
  preco: number | null;
  estoque: number | null;
  fotos: number;
  categoria: string;
}

/**
 * A impressão do ensaio: um número que muda se QUALQUER dos cinco campos
 * mudar. Mesma forma de `impressaoDoTitulo` — inteiro positivo, cabe na
 * coluna `numeric` da precondição.
 */
export function impressaoDaPublicacao(e: EnsaioDaPublicacao): number {
  const chave = [e.titulo.trim(), e.preco ?? "", e.estoque ?? "", e.fotos, e.categoria.trim()].join("");
  let h = 0;
  for (let i = 0; i < chave.length; i++) h = (h * 31 + chave.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** O pedido que vai para o Mercado Livre, inteiro, como foi ensaiado. */
export interface PedidoCongelado {
  versao: 1;
  anuncioId: string;
  produtoId: string;
  nome: string;
  marketplace: string;
  payload: Record<string, unknown>;
  userProducts?: BundleUserProducts;
  mlbsDoProduto: string[];
  tituloParaCategoria?: string;
  ensaio: EnsaioDaPublicacao;
}

export function congelarPedido(p: PedidoCongelado): string {
  return JSON.stringify(p);
}

/** `null` quando o texto não é um pedido congelado — nunca um pedido inventado. */
export function lerPedidoCongelado(texto: string | null | undefined): PedidoCongelado | null {
  if (!texto) return null;
  try {
    const p = JSON.parse(texto) as Partial<PedidoCongelado>;
    if (
      p?.versao !== 1 ||
      typeof p.anuncioId !== "string" ||
      typeof p.produtoId !== "string" ||
      !p.payload ||
      typeof p.payload !== "object" ||
      !p.ensaio ||
      typeof p.ensaio.titulo !== "string"
    ) {
      return null;
    }
    return {
      versao: 1,
      anuncioId: p.anuncioId,
      produtoId: p.produtoId,
      nome: typeof p.nome === "string" ? p.nome : "",
      marketplace: typeof p.marketplace === "string" ? p.marketplace : "Mercado Livre",
      payload: p.payload as Record<string, unknown>,
      ...(p.userProducts ? { userProducts: p.userProducts } : {}),
      mlbsDoProduto: Array.isArray(p.mlbsDoProduto) ? p.mlbsDoProduto.filter((x): x is string => typeof x === "string") : [],
      ...(typeof p.tituloParaCategoria === "string" ? { tituloParaCategoria: p.tituloParaCategoria } : {}),
      ensaio: {
        titulo: p.ensaio.titulo,
        preco: typeof p.ensaio.preco === "number" ? p.ensaio.preco : null,
        estoque: typeof p.ensaio.estoque === "number" ? p.ensaio.estoque : null,
        fotos: typeof p.ensaio.fotos === "number" ? p.ensaio.fotos : 0,
        categoria: typeof p.ensaio.categoria === "string" ? p.ensaio.categoria : "",
      },
    };
  } catch {
    return null;
  }
}
