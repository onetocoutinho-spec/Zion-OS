// Ler e gravar o peso da embalagem por PRODUTO.
//
// O peso mora na variante (uma coluna `peso`, em kg), porque é lá que a
// embalagem realmente varia. Mas quem preenche pensa em produto: "o Moleca
// 5556 pesa 400 gramas" — ninguém quer responder isso 8 vezes, uma por cor.
//
// Então este serviço traduz nos dois sentidos:
//   ler   → o peso do produto é o MAIOR entre suas variantes (mesma regra de
//           `embalagemDasVariantes`: o frete cobra pela maior caixa);
//   gravar→ o peso do produto desce para TODAS as suas variantes.
//
// Sem peso não há frete, e sem frete o preço mínimo é pendência. Na base do
// primeiro lojista eram 0 de 3.085 variantes com peso — a calculadora estava
// correta e muda por falta de entrada.

import { listarProdutosDoCliente } from "./produtos";
import { listarTodasVariantes, atualizarVariantesBulk } from "./produtoVariantes";
import type { Produto, ProdutoVariante } from "../types";

export interface ProdutoComPeso {
  id: string;
  nome: string;
  marca: string;
  custo: number;
  precoVenda: number;
  /**
   * O MAIOR entre as variantes, em GRAMAS. 0 = nenhuma variante tem peso.
   *
   * Serve ao CÁLCULO (o frete cobra pela caixa que sai) e por isso a semântica
   * é preservada. NÃO serve para responder "o cadastro está completo?" — para
   * isso existe `variacoesSemPeso`. Ver INC-001.
   */
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
  quantidadeVariantes: number;
  /**
   * Quantas variantes estão sem peso. Com `quantidadeVariantes`, é o par de onde
   * derivam os quatro estados (`catalog/domain/familiaDeProduto.situacaoDePeso`).
   *
   * Existe porque o máximo escondia o estado PARCIAL: um produto com 1 de 39
   * variantes preenchidas reportava peso e desaparecia de toda contagem de
   * pendência. Eram 12 variações inalcançáveis na base real.
   */
  variacoesSemPeso: number;
}

/** Gramas ↔ quilos num lugar só, para o arredondamento não vazar pela tela. */
const paraGramas = (kg: number) => Math.round(Math.max(0, kg) * 1000);
const paraKg = (g: number) => Math.max(0, g) / 1000;

export async function listarProdutosComPeso(clienteId: string): Promise<ProdutoComPeso[]> {
  const [produtos, variantes] = await Promise.all([
    listarProdutosDoCliente(clienteId),
    listarTodasVariantes(),
  ]);
  const porProduto = new Map<string, ProdutoVariante[]>();
  for (const v of variantes) {
    if (v.clienteId !== clienteId) continue;
    const arr = porProduto.get(v.produtoId);
    if (arr) arr.push(v);
    else porProduto.set(v.produtoId, [v]);
  }

  return produtos.map((p: Produto) => {
    const vs = porProduto.get(p.id) ?? [];
    // O MAIOR, não a média: o frete cobra pela caixa que sai, e subestimar o
    // peso produz um preço mínimo abaixo do que se paga.
    const maior = (campo: keyof ProdutoVariante) =>
      vs.reduce((acc, v) => Math.max(acc, Number(v[campo]) || 0), 0);
    return {
      id: p.id,
      nome: p.nome,
      marca: p.marca,
      custo: p.custo,
      precoVenda: p.precoVenda,
      pesoGramas: paraGramas(maior("peso")),
      alturaCm: maior("altura"),
      larguraCm: maior("largura"),
      comprimentoCm: maior("comprimento"),
      quantidadeVariantes: vs.length,
      // Contado, não deduzido do máximo: é a diferença entre "tem algum peso" e
      // "está completo", e foi confundi-las que escondeu o estado parcial.
      variacoesSemPeso: vs.filter((v) => !((Number(v.peso) || 0) > 0)).length,
    };
  });
}

export interface EmbalagemInformada {
  pesoGramas: number;
  /** 0 = não informar; não sobrescreve o que já existe. */
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;
}

export interface ResultadoPeso {
  produtos: number;
  variantes: number;
}

/**
 * Grava o peso (e, se vierem, as medidas) em todas as variantes dos produtos.
 *
 * Peso zero ou negativo é RECUSADO em vez de gravado: zero não é um peso, é a
 * ausência dele, e gravado como número faria o frete sair da faixa mais barata
 * e o preço mínimo ficar abaixo do que se paga. A pendência é mais honesta.
 */
export async function definirPesoDosProdutos(
  clienteId: string,
  produtoIds: readonly string[],
  embalagem: EmbalagemInformada
): Promise<ResultadoPeso> {
  const peso = paraKg(embalagem.pesoGramas);
  if (!Number.isFinite(peso) || peso <= 0) return { produtos: 0, variantes: 0 };
  if (produtoIds.length === 0) return { produtos: 0, variantes: 0 };

  const alvo = new Set(produtoIds);
  const variantes = (await listarTodasVariantes()).filter(
    (v) => v.clienteId === clienteId && alvo.has(v.produtoId)
  );
  if (variantes.length === 0) return { produtos: 0, variantes: 0 };

  const dados: Partial<ProdutoVariante> = { peso };
  // Medida ausente não vira 0: apagar dado bom seria pior que não trazer novo.
  if ((embalagem.alturaCm ?? 0) > 0) dados.altura = embalagem.alturaCm;
  if ((embalagem.larguraCm ?? 0) > 0) dados.largura = embalagem.larguraCm;
  if ((embalagem.comprimentoCm ?? 0) > 0) dados.comprimento = embalagem.comprimentoCm;

  await atualizarVariantesBulk(variantes.map((v) => ({ id: v.id, ...dados })));
  return { produtos: new Set(variantes.map((v) => v.produtoId)).size, variantes: variantes.length };
}
