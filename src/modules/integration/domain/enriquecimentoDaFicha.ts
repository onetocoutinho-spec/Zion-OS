// DES-002 — o que a lojista já informou ao Mercado Livre vira ficha do produto.
//
// ===========================================================================
// O QUE ESTE MÓDULO É
// ===========================================================================
//
// PURO: recebe os anúncios como o ML os devolveu e o vínculo anúncio→produto, e
// devolve um PLANO — o que gravar e o que está em conflito. Não escreve, não
// consulta, não decide sozinho.
//
// Existe separado porque a parte difícil não é escrever: é decidir o que fazer
// quando dois anúncios do mesmo produto discordam. Essa decisão é de domínio, e
// merece teste sem infraestrutura.
//
// ===========================================================================
// POR QUE DISCORDÂNCIA NÃO SE RESOLVE SOZINHA
// ===========================================================================
//
// No modelo User Products um produto vira vários MLBs — um por tamanho. Eles
// podem trazer "Material da sola" diferente, por erro de cadastro ou porque a
// linha mudou no meio.
//
// Escolher o mais frequente seria decidir em silêncio sobre dado da lojista. É
// a mesma forma do custo ambíguo, que já tem tela própria: o sistema apresenta
// os valores e quem decide é ela.
//
// GRAVA quando todos concordam. Discordou, vira conflito.

import type { AnuncioML } from "../../../lib/marketplaces/mercadolivre";

/**
 * O recorte que é NOSSO, e só ele.
 *
 * Identidade (`SELLER_SKU`, `GTIN`, `COLOR`, `SIZE`) mora na grade de variações,
 * que vem do cadastro — repeti-la seria oferecer uma SEGUNDA fonte, que foi como
 * a IA passou a inventá-la (PR #79). `PACKAGE_*` já vira peso e dimensão.
 *
 * `SIZE_GRID_ID` é referência interna do ML para a guia de tamanhos: não tem
 * tag nenhuma, então o ML não o esconde — mas ele não é característica do
 * produto, e o dono do produto decidiu deixá-lo fora.
 *
 * O QUE NÃO ESTÁ AQUI, e é o ponto: o resto do recorte vem da API do ML, por
 * categoria (`hidden`, `variation_attribute`). Uma lista escrita aqui envelhece
 * no dia em que o ML criar um atributo novo — e foi assim que 260 falsos
 * conflitos apareceram, todos `SELLER_PACKAGE_*` e `SIZE_GRID_ROW_ID` que eu
 * não sabia que existiam.
 */
export const ATRIBUTOS_COM_CASA_PROPRIA: ReadonlySet<string> = new Set([
  "SELLER_SKU",
  "GTIN",
  "COLOR",
  "SIZE",
  "PACKAGE_WEIGHT",
  "PACKAGE_HEIGHT",
  "PACKAGE_WIDTH",
  "PACKAGE_LENGTH",
  "SIZE_GRID_ID",
]);

/** O que o ML esconde, por categoria: `{ "MLB273770": ["ITEM_CONDITION", …] }`. */
export type ForaDaFichaPorCategoria = Readonly<Record<string, readonly string[]>>;

/**
 * Monta o teste "este atributo é ficha?" — nosso recorte MAIS o do ML.
 *
 * Devolve uma função e não um Set porque a resposta depende da CATEGORIA: o
 * mesmo id pode ser oculto num lugar e visível noutro, e quem sabe é o ML.
 */
export function ehDeFicha(
  fora: ForaDaFichaPorCategoria = {}
): (categoria: string, atributoId: string) => boolean {
  const cache = new Map<string, ReadonlySet<string>>();
  return (categoria, atributoId) => {
    if (ATRIBUTOS_COM_CASA_PROPRIA.has(atributoId)) return false;
    let doMl = cache.get(categoria);
    if (!doMl) {
      doMl = new Set(fora[categoria] ?? []);
      cache.set(categoria, doMl);
    }
    return !doMl.has(atributoId);
  };
}

export interface AtributoParaGravar {
  produtoId: string;
  nomeAtributo: string;
  valorAtributo: string;
}

export interface ConflitoDeAtributo {
  produtoId: string;
  nomeAtributo: string;
  /** Cada valor divergente e quantos anúncios o afirmam, do mais citado. */
  valores: { valor: string; anuncios: number }[];
}

export interface PlanoDeEnriquecimento {
  paraGravar: AtributoParaGravar[];
  conflitos: ConflitoDeAtributo[];
  /** Produtos que receberão ao menos uma linha. */
  produtos: number;
  /** Anúncios cujo MLB não tem produto vinculado — não somem, são contados. */
  anunciosSemProduto: number;
}

/**
 * Monta o plano.
 *
 * `produtoPorMlb` é o vínculo que já existe em `anuncios_gerados`
 * (`ml_item_id` → `produto_id`). Anúncio sem vínculo NÃO é ignorado em
 * silêncio: entra na contagem, porque "não gravei nada para 40 anúncios" é uma
 * informação, e some se ninguém contar.
 */
export function planejarEnriquecimento(
  anuncios: readonly AnuncioML[],
  produtoPorMlb: ReadonlyMap<string, string>,
  fora: ForaDaFichaPorCategoria = {}
): PlanoDeEnriquecimento {
  const daFicha = ehDeFicha(fora);
  // produtoId → nomeAtributo → valor → quantos anúncios dizem isso.
  const porProduto = new Map<string, Map<string, Map<string, number>>>();
  let anunciosSemProduto = 0;

  for (const a of anuncios) {
    const produtoId = produtoPorMlb.get(a.mlb);
    if (!produtoId) {
      anunciosSemProduto++;
      continue;
    }
    const doProduto = porProduto.get(produtoId) ?? new Map();
    porProduto.set(produtoId, doProduto);

    for (const at of a.atributos) {
      if (!daFicha(a.categoria, at.id)) continue;
      const nome = at.nome || at.id;
      const valores = doProduto.get(nome) ?? new Map<string, number>();
      doProduto.set(nome, valores);
      valores.set(at.valor, (valores.get(at.valor) ?? 0) + 1);
    }
  }

  const paraGravar: AtributoParaGravar[] = [];
  const conflitos: ConflitoDeAtributo[] = [];
  const produtosComLinha = new Set<string>();

  for (const [produtoId, atributos] of porProduto) {
    for (const [nomeAtributo, valores] of atributos) {
      if (valores.size === 1) {
        const [valorAtributo] = [...valores.keys()];
        paraGravar.push({ produtoId, nomeAtributo, valorAtributo });
        produtosComLinha.add(produtoId);
        continue;
      }
      conflitos.push({
        produtoId,
        nomeAtributo,
        valores: [...valores.entries()]
          .map(([valor, anuncios]) => ({ valor, anuncios }))
          .sort((x, y) => y.anuncios - x.anuncios || x.valor.localeCompare(y.valor)),
      });
    }
  }

  // Ordem estável: o mesmo insumo produz o mesmo plano, sempre. Sem isso, dois
  // enriquecimentos seguidos gerariam diffs diferentes do mesmo dado.
  const porChave = (a: { produtoId: string; nomeAtributo: string }, b: typeof a) =>
    a.produtoId.localeCompare(b.produtoId) || a.nomeAtributo.localeCompare(b.nomeAtributo);

  return {
    paraGravar: paraGravar.sort(porChave),
    conflitos: conflitos.sort(porChave),
    produtos: produtosComLinha.size,
    anunciosSemProduto,
  };
}
