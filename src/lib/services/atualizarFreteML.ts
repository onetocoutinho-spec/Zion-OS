// Atualizar SÓ quem paga o frete, sem apagar nada.
//
// POR QUE ISTO EXISTE, EM VEZ DE REIMPORTAR
//
// O botão "Importar do ML" tem dois modos, e nenhum serve para buscar um campo
// que a importação antiga não guardava:
//
//   "substituir" APAGA os produtos importados antes de trazer tudo de novo.
//     Numa base já trabalhada isso leva junto peso, custo, imagens e anúncios
//     gerados — desfaz semanas de preenchimento para buscar um booleano.
//   "novos" só adiciona MLBs inéditos. Produto que já existe não é tocado, e o
//     campo continua vazio.
//
// Então a operação certa não é reimportar: é ir buscar os anúncios, casar pelo
// MLB que já está guardado, e escrever UMA coluna.
//
// A REGRA DE CASAMENTO
//
// O vínculo MLB → produto já existe em `anuncios_gerados.ml_item_id`. Não há
// casamento por nome aqui, e isso é deliberado: casar por semelhança já
// atribuiu o custo de um sapato a outro modelo nesta mesma base.
//
// Um produto pode ter vários anúncios (um por tamanho, no modelo User
// Products). Se eles discordarem sobre o frete, o produto fica com "o vendedor
// paga" — a direção segura, a mesma de quando não se sabe.

import { cabecalhoAutenticacao } from "../supabase/sessao";
import { listarAnunciosGeradosDoCliente } from "./anunciosGerados";
import { listarProdutosDoCliente, atualizarProdutosBulk } from "./produtos";
import type { AnuncioML } from "../marketplaces/mercadolivre";
import type { Produto } from "../types";

export interface ResultadoFrete {
  /** Produtos que passaram a ter a informação. */
  atualizados: number;
  /** Produtos em que o VENDEDOR paga (frete grátis). */
  vendedorPaga: number;
  /** Produtos em que o COMPRADOR paga — nesses o frete sai da conta. */
  compradorPaga: number;
  /** Produtos cujos anúncios não informaram, ou que não têm anúncio no ML. */
  semInformacao: number;
  aviso?: string;
}

export async function atualizarFreteDosProdutos(clienteId: string): Promise<ResultadoFrete> {
  const vazio: ResultadoFrete = {
    atualizados: 0,
    vendedorPaga: 0,
    compradorPaga: 0,
    semInformacao: 0,
  };

  // O refresh_token fica no servidor: enviamos só o clienteId + a sessão.
  const resposta = await fetch("/api/ml/importar-anuncios", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await cabecalhoAutenticacao()) },
    body: JSON.stringify({ clienteId }),
  });
  const dados = (await resposta.json()) as { anuncios?: AnuncioML[]; erro?: string };
  if (!resposta.ok) {
    return { ...vazio, aviso: dados.erro ?? "Não foi possível falar com o Mercado Livre." };
  }

  const porMlb = new Map<string, boolean>();
  for (const a of dados.anuncios ?? []) {
    if (a.mlb && typeof a.vendedorPagaFrete === "boolean") porMlb.set(a.mlb, a.vendedorPagaFrete);
  }
  if (porMlb.size === 0) {
    return { ...vazio, aviso: "Nenhum anúncio informou o frete." };
  }

  // MLB → produto, pelo vínculo que a importação já gravou.
  const anunciosGravados = await listarAnunciosGeradosDoCliente(clienteId);
  const porProduto = new Map<string, boolean[]>();
  for (const g of anunciosGravados) {
    const mlb = (g.mlItemId ?? "").trim();
    if (!mlb || !g.produtoId) continue;
    const valor = porMlb.get(mlb);
    if (valor === undefined) continue;
    const lista = porProduto.get(g.produtoId);
    if (lista) lista.push(valor);
    else porProduto.set(g.produtoId, [valor]);
  }

  const produtos = await listarProdutosDoCliente(clienteId);
  const mudancas: (Partial<Produto> & { id: string })[] = [];
  let vendedorPaga = 0;
  let compradorPaga = 0;

  for (const p of produtos) {
    const valores = porProduto.get(p.id);
    if (!valores || valores.length === 0) continue;
    // Anúncios do mesmo produto discordando: fica "o vendedor paga". Supor o
    // contrário tiraria da conta um custo que talvez exista, e margem otimista
    // é o defeito que este modelo mais repetiu.
    const paga = valores.some((v) => v === true);
    if (paga) vendedorPaga++;
    else compradorPaga++;
    // Só grava o que MUDA: reescrever o valor igual sujaria o updated_at de
    // todo mundo e apagaria a pista de quando o dado realmente chegou.
    if (p.vendedorPagaFrete !== paga) {
      mudancas.push({ id: p.id, vendedorPagaFrete: paga });
    }
  }

  if (mudancas.length > 0) await atualizarProdutosBulk(mudancas);

  return {
    atualizados: mudancas.length,
    vendedorPaga,
    compradorPaga,
    semInformacao: produtos.length - vendedorPaga - compradorPaga,
  };
}
