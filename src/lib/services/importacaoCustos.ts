// Importação de custos em massa (planilha CSV/Excel).
//
// Casa cada linha por:
//   1) SKU  → variação e/ou SKU pai/codErp;
//   2) NOME do produto → exato (normalizado) e, se não achar, o mais parecido
//      por sobreposição de palavras.
// Atualiza o custo e recalcula margem e preço mínimo (modelo Zion). Quando casa
// por nome, propaga o custo para todas as variações do produto.

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
/** Remove zeros à esquerda (Excel dropa "01003335" → "1003335"). */
const semZeros = (s: string) => s.replace(/^0+/, "");
const normNome = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const palavras = (s: string) => new Set(normNome(s).split(" ").filter((w) => w.length > 2));

/** Lê "12,50" / "12.50" / "R$ 1.234,56" → número. */
function parseNumero(s: string): number {
  let t = s.replace(/[^\d.,-]/g, "").trim();
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

interface EntradaNome {
  palavras: Set<string>;
  custo: number;
}

export async function importarCustos(clienteId: string, planilha: PlanilhaLida): Promise<ResultadoCustos> {
  const { headers, linhas } = planilha;
  const achaPor = (teste: (n: string) => boolean) => headers.find((h) => teste(normalizarHeader(h)));
  // Detecção tolerante: "Custo (R$)" vira "custo_r", "SKU Pai" vira "sku_pai" etc.
  const hSku = achaPor(
    (n) =>
      n === "sku" ||
      n.startsWith("sku") ||
      ["codigo", "cod", "seller_sku", "codigo_sku", "cod_erp", "codigo_erp", "sku_erp"].includes(n)
  );
  const hNome = achaPor(
    (n) =>
      ["nome", "produto", "descricao", "titulo", "nome_produto", "descricao_produto", "item"].includes(n) ||
      n.startsWith("nome") ||
      n.startsWith("produto") ||
      n.startsWith("descricao")
  );
  const hEan = achaPor(
    (n) => n === "ean" || n === "gtin" || n === "ean13" || n.startsWith("codigo_barras") || n.startsWith("cod_barras")
  );
  const hCusto = achaPor(
    (n) => n.startsWith("custo") || ["cost", "preco_custo", "valor_custo", "custounit"].includes(n)
  );
  if (!hCusto || (!hSku && !hNome && !hEan)) {
    return {
      produtos: 0,
      variantes: 0,
      naoEncontrados: 0,
      linhasCsv: linhas.length,
      aviso: "A planilha precisa da coluna 'custo' e de 'sku', 'ean' e/ou 'nome/produto'.",
    };
  }

  const porSku = new Map<string, number>();
  const porEan = new Map<string, number>();
  const porNomeExato = new Map<string, number>();
  const entradasNome: EntradaNome[] = [];
  for (const row of linhas) {
    const custo = parseNumero(row[hCusto] ?? "");
    if (custo <= 0) continue;
    if (hSku) {
      const sku = norm(row[hSku] ?? "");
      if (sku) {
        porSku.set(sku, custo);
        const z = semZeros(sku);
        if (z && z !== sku) porSku.set(z, custo);
      }
    }
    if (hEan) {
      const ean = (row[hEan] ?? "").replace(/\D/g, "");
      if (ean) porEan.set(ean, custo);
    }
    if (hNome) {
      const nome = (row[hNome] ?? "").trim();
      if (nome) {
        porNomeExato.set(normNome(nome), custo);
        entradasNome.push({ palavras: palavras(nome), custo });
      }
    }
  }
  if (porSku.size === 0 && porEan.size === 0 && porNomeExato.size === 0) {
    return { produtos: 0, variantes: 0, naoEncontrados: 0, linhasCsv: linhas.length, aviso: "Nenhum custo válido na planilha." };
  }

  const produtos = await listarProdutosDoCliente(clienteId);
  const todasVar = (await listarTodasVariantes()).filter((v) => v.clienteId === clienteId);
  const varsPorProduto = new Map<string, ProdutoVariante[]>();
  for (const v of todasVar) {
    const arr = varsPorProduto.get(v.produtoId) ?? [];
    arr.push(v);
    varsPorProduto.set(v.produtoId, arr);
  }

  const varAtualizadas: ProdutoVariante[] = [];
  const idVarCasada = new Set<string>();
  const custosPorProduto = new Map<string, number[]>();
  const usados = new Set<string>();

  // 1) Variações por SKU ou EAN.
  for (const v of todasVar) {
    const skuV = norm(v.sku);
    let c = porSku.get(skuV) ?? porSku.get(semZeros(skuV));
    if (c != null) usados.add(skuV);
    if (c == null && v.ean) {
      const ean = v.ean.replace(/\D/g, "");
      c = porEan.get(ean);
      if (c != null) usados.add(ean);
    }
    if (c == null) continue;
    idVarCasada.add(v.id);
    varAtualizadas.push({ ...v, custo: c });
    const arr = custosPorProduto.get(v.produtoId) ?? [];
    arr.push(c);
    custosPorProduto.set(v.produtoId, arr);
  }

  /** Melhor custo por nome (exato, senão o mais parecido). */
  function custoPorNome(nomeProduto: string): number | null {
    const exato = porNomeExato.get(normNome(nomeProduto));
    if (exato != null) return exato;
    const pp = palavras(nomeProduto);
    if (pp.size === 0) return null;
    let melhor = 0;
    let custo: number | null = null;
    for (const e of entradasNome) {
      let comuns = 0;
      for (const w of e.palavras) if (pp.has(w)) comuns++;
      const score = comuns / Math.max(e.palavras.size, pp.size, 1);
      if (score > melhor) {
        melhor = score;
        custo = e.custo;
      }
    }
    return melhor >= 0.6 ? custo : null;
  }

  // 2) Produtos: SKU/codErp → NOME → menor custo das variações.
  const prodAtualizados: Produto[] = [];
  for (const p of produtos) {
    let custo = porSku.get(norm(p.sku)) ?? porSku.get(semZeros(norm(p.sku)));
    if (custo != null) usados.add(norm(p.sku));
    if (custo == null && p.codErp) {
      custo = porSku.get(norm(p.codErp)) ?? porSku.get(semZeros(norm(p.codErp)));
      if (custo != null) usados.add(norm(p.codErp));
    }
    let porNome = false;
    if (custo == null && hNome) {
      const c = custoPorNome(p.nome);
      if (c != null) {
        custo = c;
        porNome = true;
      }
    }
    if (custo == null) {
      const cs = custosPorProduto.get(p.id);
      if (cs && cs.length > 0) custo = Math.min(...cs);
    }
    if (custo == null || custo <= 0) continue;

    prodAtualizados.push({
      ...p,
      custo,
      // ?? undefined: margem desconhecida some do registro em vez de virar 0,
      // que o resto do sistema leria como "sem margem nenhuma".
      margem: margemZion(custo, p.precoVenda) ?? undefined,
      precoMinimo: precoMinimoZion(custo) ?? undefined,
      confiancaCusto: "alta",
    });
    if (porNome) usados.add(normNome(p.nome));

    // Propaga o custo para as variações ainda não casadas por SKU.
    for (const v of varsPorProduto.get(p.id) ?? []) {
      if (!idVarCasada.has(v.id)) {
        idVarCasada.add(v.id);
        varAtualizadas.push({ ...v, custo });
      }
    }
  }

  if (varAtualizadas.length > 0) await atualizarVariantesBulk(varAtualizadas);
  if (prodAtualizados.length > 0) await atualizarProdutosBulk(prodAtualizados);

  let naoEncontrados = 0;
  for (const sku of porSku.keys()) if (!usados.has(sku)) naoEncontrados++;
  for (const ean of porEan.keys()) if (!usados.has(ean)) naoEncontrados++;

  return {
    produtos: prodAtualizados.length,
    variantes: varAtualizadas.length,
    naoEncontrados,
    linhasCsv: linhas.length,
  };
}
