// Importação de custos em massa (planilha CSV: sku → custo).
//
// Casa por SKU (variação e/ou SKU pai/codErp), atualiza o custo e recalcula
// margem e preço mínimo pelo modelo Zion. Para produtos com variação, o custo
// do pai vira o MENOR custo das variações casadas (referência p/ margem/nota).

import { normalizarHeader } from "../csv";
import type { PlanilhaLida } from "../planilha";
import { listarProdutosDoCliente, atualizarProdutosBulk } from "./produtos";
import { listarTodasVariantes, atualizarVariantesBulk } from "./produtoVariantes";
import { margemZion, precoMinimoZion } from "./importacaoProdutos";
import type { Produto, ProdutoVariante } from "../types";

export interface ResultadoCustos {
  produtos: number;
  variantes: number;
  naoEncontrados: number;
  linhasCsv: number;
  aviso?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Lê "12,50" / "12.50" / "R$ 1.234,56" → número. */
function parseNumero(s: string): number {
  let t = s.replace(/[^\d.,-]/g, "").trim();
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); // vírgula = decimal BR
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

export async function importarCustos(clienteId: string, planilha: PlanilhaLida): Promise<ResultadoCustos> {
  const { headers, linhas } = planilha;
  const acha = (nomes: string[]) => headers.find((h) => nomes.includes(normalizarHeader(h)));
  const hSku = acha(["sku", "codigo", "cod", "seller_sku", "sku_variacao", "codigo_sku"]);
  const hCusto = acha(["custo", "custo_unitario", "custounit", "preco_custo", "cost", "valor_custo"]);
  if (!hSku || !hCusto) {
    return { produtos: 0, variantes: 0, naoEncontrados: 0, linhasCsv: linhas.length, aviso: "CSV precisa das colunas 'sku' e 'custo'." };
  }

  const mapa = new Map<string, number>();
  for (const row of linhas) {
    const sku = norm(row[hSku] ?? "");
    const custo = parseNumero(row[hCusto] ?? "");
    if (sku && custo > 0) mapa.set(sku, custo);
  }
  if (mapa.size === 0) {
    return { produtos: 0, variantes: 0, naoEncontrados: 0, linhasCsv: linhas.length, aviso: "Nenhum par SKU/custo válido no CSV." };
  }

  const produtos = await listarProdutosDoCliente(clienteId);
  const variantes = (await listarTodasVariantes()).filter((v) => v.clienteId === clienteId);

  // 1) Variações casadas por SKU.
  const varAtualizadas: ProdutoVariante[] = [];
  const custosPorProduto = new Map<string, number[]>();
  const skusUsados = new Set<string>();
  for (const v of variantes) {
    const c = mapa.get(norm(v.sku));
    if (c == null) continue;
    skusUsados.add(norm(v.sku));
    varAtualizadas.push({ ...v, custo: c });
    const arr = custosPorProduto.get(v.produtoId) ?? [];
    arr.push(c);
    custosPorProduto.set(v.produtoId, arr);
  }

  // 2) Produtos: por SKU/codErp direto, senão menor custo das variações.
  const prodAtualizados: Produto[] = [];
  for (const p of produtos) {
    let custo = mapa.get(norm(p.sku));
    if (custo != null) skusUsados.add(norm(p.sku));
    if (custo == null && p.codErp) {
      custo = mapa.get(norm(p.codErp));
      if (custo != null) skusUsados.add(norm(p.codErp));
    }
    if (custo == null) {
      const cs = custosPorProduto.get(p.id);
      if (cs && cs.length > 0) custo = Math.min(...cs);
    }
    if (custo != null && custo > 0) {
      prodAtualizados.push({
        ...p,
        custo,
        margem: margemZion(custo, p.precoVenda),
        precoMinimo: precoMinimoZion(custo),
        confiancaCusto: "alta",
      });
    }
  }

  if (varAtualizadas.length > 0) await atualizarVariantesBulk(varAtualizadas);
  if (prodAtualizados.length > 0) await atualizarProdutosBulk(prodAtualizados);

  let naoEncontrados = 0;
  for (const sku of mapa.keys()) if (!skusUsados.has(sku)) naoEncontrados++;

  return {
    produtos: prodAtualizados.length,
    variantes: varAtualizadas.length,
    naoEncontrados,
    linhasCsv: linhas.length,
  };
}
