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
  /** Linhas da planilha que não casaram com nenhum produto. */
  naoEncontrados: number;
  linhasCsv: number;
  /** Produtos que casaram com custos DIFERENTES e por isso ficaram de fora. */
  ambiguos: number;
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

/**
 * Lê "12,50" / "12.50" / "R$ 1.234,56" / "1.234" → número. PURA.
 *
 * A armadilha é o PONTO sem vírgula: "1.234" pode ser mil duzentos e trinta e
 * quatro (padrão brasileiro) ou um vírgula duzentos e trinta e quatro (padrão
 * americano). A regra que distingue com segurança é a do separador de milhar:
 * ele SEMPRE agrupa de três em três. Então ".234" é milhar e ".90" é decimal.
 *
 * Errar isso lia R$ 1.234 como R$ 1,23 — custo mil vezes menor, e a margem
 * aparecia absurdamente positiva sem ninguém desconfiar.
 */
export function parseNumeroCusto(s: string): number {
  const t = (s ?? "").replace(/[^\d.,-]/g, "").trim();
  if (!t) return 0;

  let normalizado: string;
  if (t.includes(",")) {
    // Com vírgula presente, ela é o decimal e o ponto é milhar. Sem ambiguidade.
    normalizado = t.replace(/\./g, "").replace(",", ".");
  } else if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(t)) {
    // Só pontos, todos agrupando de 3 em 3 → separador de milhar.
    //
    // O primeiro grupo não pode começar com zero: ninguém escreve "0.850" para
    // oitocentos e cinquenta. Sem essa guarda, um custo de R$ 0,850 virava
    // R$ 850 — mil vezes maior, e o preço mínimo junto.
    normalizado = t.replace(/\./g, "");
  } else {
    // Um ponto com 1, 2 ou 4+ dígitos depois → decimal.
    normalizado = t;
  }
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/**
 * O código do modelo embutido no nome, como uma sequência única de dígitos.
 *
 * "Tênis Actvitta 4938.101 Xangai" → "4938101"
 * "Tênis Actvitta 4938101 Xangai"  → "4938101"
 *
 * Concatenar em vez de guardar os grupos separados é o que faz "7141.100" e
 * "7141100" — a mesma referência escrita de dois jeitos — serem reconhecidas
 * como iguais. Grupos separados dão conjuntos disjuntos e o casamento falha.
 */
function codigoDoNome(s: string): string {
  return (normNome(s).match(/\d+/g) ?? []).join("");
}

/** Sobreposição de palavras entre dois nomes, de 0 a 1. PURA. */
export function pontuarNomes(a: string, b: string): number {
  const pa = palavras(a);
  const pb = palavras(b);
  if (pa.size === 0 || pb.size === 0) return 0;
  let comuns = 0;
  for (const w of pb) if (pa.has(w)) comuns++;
  return comuns / Math.max(pa.size, pb.size, 1);
}

/**
 * Estes dois nomes são o MESMO produto? PURA.
 *
 * A sobreposição de palavras sozinha não serve. Num catálogo de calçados os
 * nomes são seriados e diferem só no código do modelo:
 *
 *   "Tênis Actvitta 4938.101 Xangai/Aus"  ↔  "Tênis Actvitta 4849.101 Xangai/Aus"
 *
 * São 83% de palavras em comum e produtos DIFERENTES. Com o limiar antigo de
 * 0,6 o custo de um ia para o outro, em silêncio — e custo errado é pior que
 * custo ausente, porque a tela passa a mostrar margem com confiança.
 *
 * Então o número manda: se os dois lados têm código, eles precisam bater.
 * Se só um tem, não casa — "Tênis Actvitta" genérico não pode herdar o custo
 * de um modelo específico. Sem código nos dois, aí sim decide a semelhança,
 * com limiar alto.
 *
 * Código igual sozinho também não basta: "Chinelo Havaianas 39/40" e "Sandália
 * Modare 39/40" compartilham "3940" e não têm nada a ver. Por isso o texto
 * ainda precisa se parecer minimamente.
 */
export function mesmaIdentidade(a: string, b: string): boolean {
  const ca = codigoDoNome(a);
  const cb = codigoDoNome(b);

  if (ca && cb) return ca === cb && pontuarNomes(a, b) >= 0.4;
  if (ca !== cb) return false; // código de um lado só: não decide nada

  return pontuarNomes(a, b) >= 0.85;
}

interface EntradaNome {
  palavras: Set<string>;
  custo: number;
  /** O nome como veio, para a comparação de identidade. */
  original: string;
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
      ambiguos: 0,
      aviso: "A planilha precisa da coluna 'custo' e de 'sku', 'ean' e/ou 'nome/produto'.",
    };
  }

  const porSku = new Map<string, number>();
  const porEan = new Map<string, number>();
  const porNomeExato = new Map<string, number>();
  const entradasNome: EntradaNome[] = [];
  for (const row of linhas) {
    const custo = parseNumeroCusto(row[hCusto] ?? "");
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
        entradasNome.push({ palavras: palavras(nome), custo, original: nome });
      }
    }
  }
  if (porSku.size === 0 && porEan.size === 0 && porNomeExato.size === 0) {
    return {
      produtos: 0, variantes: 0, naoEncontrados: 0, linhasCsv: linhas.length, ambiguos: 0,
      aviso: "Nenhum custo válido na planilha. Confira se a coluna de custo tem números.",
    };
  }

  const produtos = await listarProdutosDoCliente(clienteId);
  const todasVar = (await listarTodasVariantes()).filter((v) => v.clienteId === clienteId);
  const varsPorProduto = new Map<string, ProdutoVariante[]>();
  for (const v of todasVar) {
    const arr = varsPorProduto.get(v.produtoId) ?? [];
    arr.push(v);
    varsPorProduto.set(v.produtoId, arr);
  }

  // PARCIAIS de propósito: só id + o que muda. Mandar a linha inteira acopla a
  // importação a todas as colunas, e uma coluna ausente no banco derruba o lote
  // por causa de um campo que nem se queria alterar.
  const varAtualizadas: (Partial<ProdutoVariante> & { id: string })[] = [];
  const idVarCasada = new Set<string>();
  const custosPorProduto = new Map<string, number[]>();
  const usados = new Set<string>();
  /** Produtos que casaram com mais de um custo — não se escolhe por conta própria. */
  const ambiguos = new Set<string>();

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
    varAtualizadas.push({ id: v.id, custo: c });
    const arr = custosPorProduto.get(v.produtoId) ?? [];
    arr.push(c);
    custosPorProduto.set(v.produtoId, arr);
  }

  /**
   * Melhor custo por nome. Exige IDENTIDADE, não semelhança — ver
   * `mesmaIdentidade`. E recusa quando DUAS linhas diferentes reivindicam o
   * mesmo produto com custos diferentes: aí não há resposta certa, e chutar
   * uma seria gravar custo errado sem avisar.
   */
  function custoPorNome(nomeProduto: string): number | null {
    const exato = porNomeExato.get(normNome(nomeProduto));
    if (exato != null) return exato;

    const candidatos = entradasNome.filter((e) => mesmaIdentidade(e.original, nomeProduto));
    if (candidatos.length === 0) return null;

    const custos = new Set(candidatos.map((c) => c.custo));
    if (custos.size > 1) {
      ambiguos.add(nomeProduto); // duas linhas brigando pelo mesmo produto
      return null;
    }
    return candidatos[0].custo;
  }

  // 2) Produtos: SKU/codErp → NOME → menor custo das variações.
  const prodAtualizados: (Partial<Produto> & { id: string })[] = [];
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
      id: p.id,
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
        varAtualizadas.push({ id: v.id, custo });
      }
    }
  }

  if (varAtualizadas.length > 0) await atualizarVariantesBulk(varAtualizadas);
  if (prodAtualizados.length > 0) await atualizarProdutosBulk(prodAtualizados);

  // O contador antigo só olhava SKU e EAN. Uma planilha SÓ COM NOMES reportava
  // "0 não encontrados" mesmo sem casar nada — o lojista concluía que tinha
  // dado certo. Agora conta os nomes também.
  let naoEncontrados = 0;
  for (const sku of porSku.keys()) if (!usados.has(sku)) naoEncontrados++;
  for (const ean of porEan.keys()) if (!usados.has(ean)) naoEncontrados++;
  for (const nome of porNomeExato.keys()) if (!usados.has(nome)) naoEncontrados++;

  const avisos: string[] = [];
  if (ambiguos.size > 0) {
    avisos.push(
      `${ambiguos.size} produto(s) casaram com mais de um custo diferente e ficaram de fora — ` +
        `escolher um por conta própria gravaria custo errado. Use o SKU para desempatar.`
    );
  }
  if (prodAtualizados.length === 0) {
    avisos.push(
      "Nenhum produto casou. Confira se a coluna de SKU da planilha usa o mesmo código do cadastro."
    );
  }

  return {
    produtos: prodAtualizados.length,
    variantes: varAtualizadas.length,
    naoEncontrados,
    linhasCsv: linhas.length,
    ambiguos: ambiguos.size,
    ...(avisos.length > 0 ? { aviso: avisos.join(" ") } : {}),
  };
}
