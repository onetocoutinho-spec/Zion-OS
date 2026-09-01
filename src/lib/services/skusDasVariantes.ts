// Quem está sem código, e a gravação dos códigos colados.
//
// O código da variação (SKU) é a CHAVE de tudo que vem do ERP: custo, peso,
// medidas. Sem ele nenhuma planilha alcança o produto — foi assim que doze
// produtos desta base ficaram fora de todas as importações de 17 e 18/08/2026.

import { listarProdutosDoCliente } from "./produtos";
import { listarTodasVariantes, atualizarVariantesBulk } from "./produtoVariantes";
import type { Atribuicao, VarianteSemSku } from "../../modules/catalog/domain/colarSkus";

export interface ProdutoSemCodigo {
  id: string;
  nome: string;
  /** Só as variações SEM código — são elas que a tela lista. */
  variantes: VarianteSemSku[];
  /** Quantas variações o produto tem ao todo. */
  total: number;
  /** Peças em estoque nas variações sem código: é o que decide a prioridade. */
  estoque: number;
  temCusto: boolean;
}

/**
 * Os produtos com variação sem código, do que mais rende para o que menos.
 *
 * Ordena por ESTOQUE, e não por quantidade de variações: 14 variações com 567
 * peças valem mais que 27 com 30. Medido em 18/08/2026 — dois produtos
 * concentravam 687 das 839 peças da lista.
 */
export async function listarSemCodigo(clienteId: string): Promise<ProdutoSemCodigo[]> {
  const [produtos, todas] = await Promise.all([
    listarProdutosDoCliente(clienteId),
    listarTodasVariantes(),
  ]);
  const porProduto = new Map<string, typeof todas>();
  for (const v of todas) {
    if (v.clienteId !== clienteId) continue;
    const arr = porProduto.get(v.produtoId);
    if (arr) arr.push(v);
    else porProduto.set(v.produtoId, [v]);
  }

  const lista: ProdutoSemCodigo[] = [];
  for (const p of produtos) {
    const vs = porProduto.get(p.id) ?? [];
    const sem = vs.filter((v) => !(v.sku ?? "").trim());
    if (sem.length === 0) continue;
    lista.push({
      id: p.id,
      nome: p.nome,
      variantes: sem.map((v) => ({ id: v.id, cor: v.cor ?? "", tamanho: v.tamanho ?? "" })),
      total: vs.length,
      estoque: sem.reduce((s, v) => s + (Number(v.estoque) || 0), 0),
      temCusto: (Number(p.custo) || 0) > 0,
    });
  }
  return lista.sort((a, b) => b.estoque - a.estoque || b.variantes.length - a.variantes.length);
}

/**
 * Códigos JÁ EM USO por outras variações desta loja.
 *
 * Gravar um código que já existe faria a planilha do ERP acertar DUAS variações
 * com o mesmo custo e o mesmo peso — e as duas são peças diferentes. A tela
 * mostra antes; aqui só se lê.
 */
export async function codigosEmUso(clienteId: string, exceto: readonly string[]): Promise<Set<string>> {
  const fora = new Set(exceto);
  const todas = await listarTodasVariantes();
  const usados = new Set<string>();
  for (const v of todas) {
    if (v.clienteId !== clienteId) continue;
    if (fora.has(v.id)) continue;
    const s = (v.sku ?? "").trim().toLowerCase();
    if (s) usados.add(s);
  }
  return usados;
}

/**
 * Grava os códigos. Payload PARCIAL — só o campo que muda.
 *
 * Mandar a linha inteira acopla a gravação a todas as colunas, e uma coluna
 * ausente no banco derruba o lote por causa de um campo que ninguém queria
 * tocar. Já aconteceu com a importação de custos.
 */
export async function gravarSkus(atribuicoes: readonly Atribuicao[]): Promise<number> {
  const validas = atribuicoes.filter((a) => a.sku.trim() !== "");
  if (validas.length === 0) return 0;
  await atualizarVariantesBulk(validas.map((a) => ({ id: a.varianteId, sku: a.sku.trim() })));
  return validas.length;
}
