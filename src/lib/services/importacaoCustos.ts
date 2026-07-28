// Importação de custos em massa (planilha CSV/Excel).
//
// Casa cada linha por:
//   1) SKU  → variação e/ou SKU pai/codErp;
//   2) NOME do produto → exato (normalizado) e, se não achar, o mais parecido
//      por sobreposição de palavras.
// Atualiza o custo e recalcula margem e preço mínimo (modelo Zion). Quando casa
// por nome, propaga o custo para todas as variações do produto.

import type { PlanilhaLida } from "../planilha";
import {
  colunaDoPapel,
  sugerirMapeamento,
  type Mapeamento,
} from "../../modules/catalog/domain/mapeamentoPlanilha";
import { parseNumeroCusto } from "../../modules/pricing/domain/custoDigitado";
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
  /**
   * QUAIS produtos, e quais custos brigaram por eles.
   *
   * Sem isto o relatório dizia "17 produto(s) ambíguo(s)" e mais nada — o
   * lojista sabia que perdeu 17 custos e não tinha como descobrir quais, nem
   * decidir. Recusar de propósito só é honesto se a pessoa puder resolver.
   */
  detalhesAmbiguos: AmbiguidadeCusto[];
  aviso?: string;
}

/** Um produto que casou com mais de um custo, e os custos em disputa. */
export interface AmbiguidadeCusto {
  produtoId: string;
  produto: string;
  /** Custos distintos que reivindicaram este produto, com a linha de origem. */
  candidatos: { custo: number; origem: string }[];
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
 * Lê "12,50" / "R$ 1.234,56" / "1.234" → número.
 *
 * Mudou de casa para `modules/pricing/domain/custoDigitado` quando o custo
 * passou a entrar por dois caminhos — planilha e teclado. Regra que dois
 * caminhos usam mora no domínio; deixada aqui, um dos dois acabaria com uma
 * cópia que envelhece sozinha, e a regra do separador de milhar é exatamente o
 * tipo de detalhe que ninguém lembra de copiar de volta.
 *
 * Continua exportada daqui porque é por este nome que a importação a conhece.
 */
export { parseNumeroCusto };

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

/**
 * Importa custos usando um mapeamento EXPLÍCITO de colunas.
 *
 * O mapa é opcional só para não quebrar quem já chamava; quando ele falta, a
 * sugestão automática entra no lugar. Mas o caminho certo é a tela mostrar a
 * sugestão, deixar a pessoa corrigir, e passar o resultado aqui — foi adivinhar
 * em silêncio que gravou 87 referências de modelo como se fossem dinheiro.
 */
export async function importarCustos(
  clienteId: string,
  planilha: PlanilhaLida,
  mapa?: Mapeamento
): Promise<ResultadoCustos> {
  const { headers, linhas } = planilha;
  const mapeamento = mapa ?? sugerirMapeamento(headers);
  const hSku = colunaDoPapel(mapeamento, "sku");
  const hNome = colunaDoPapel(mapeamento, "nome");
  const hEan = colunaDoPapel(mapeamento, "ean");
  const hCusto = colunaDoPapel(mapeamento, "custo");
  if (!hCusto || (!hSku && !hNome && !hEan)) {
    return {
      produtos: 0,
      variantes: 0,
      naoEncontrados: 0,
      linhasCsv: linhas.length,
      ambiguos: 0,
      detalhesAmbiguos: [],
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
      detalhesAmbiguos: [],
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
  const ambiguos = new Map<string, { produto: string; candidatos: { custo: number; origem: string }[] }>();

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
  function custoPorNome(nomeProduto: string, produtoId: string): number | null {
    const exato = porNomeExato.get(normNome(nomeProduto));
    if (exato != null) return exato;

    const candidatos = entradasNome.filter((e) => mesmaIdentidade(e.original, nomeProduto));
    if (candidatos.length === 0) return null;

    const custos = new Set(candidatos.map((c) => c.custo));
    if (custos.size > 1) {
      // Duas linhas brigando pelo mesmo produto. Guarda QUAIS, para a tela
      // poder mostrar e a pessoa decidir — recusar em silêncio só empurra o
      // problema para um lugar onde ninguém o vê.
      const vistos = new Set<number>();
      const distintos: { custo: number; origem: string }[] = [];
      for (const c of candidatos) {
        if (vistos.has(c.custo)) continue;
        vistos.add(c.custo);
        distintos.push({ custo: c.custo, origem: c.original });
      }
      ambiguos.set(produtoId, { produto: nomeProduto, candidatos: distintos });
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
      const c = custoPorNome(p.nome, p.id);
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

  // Conta LINHAS da planilha que não acharam produto — uma por linha.
  //
  // A versão anterior somava chaves não-casadas de três mapas (sku, ean, nome),
  // e uma linha que tem os três contava até três vezes. O relatório saiu com
  // "1853 linhas sem produto correspondente" numa planilha de 1374 linhas —
  // número maior que o total, no rótulo errado. Um relatório que se contradiz
  // não é só feio: ele treina a pessoa a ignorar o relatório.
  let naoEncontrados = 0;
  for (const row of linhas) {
    const custo = hCusto ? parseNumeroCusto(row[hCusto] ?? "") : 0;
    if (custo <= 0) continue; // linha sem custo não é "produto não encontrado"
    const chaves: string[] = [];
    if (hSku) {
      const sku = norm(row[hSku] ?? "");
      if (sku) chaves.push(sku, semZeros(sku));
    }
    if (hEan) {
      const ean = (row[hEan] ?? "").replace(/\D/g, "");
      if (ean) chaves.push(ean);
    }
    if (hNome) {
      const nome = (row[hNome] ?? "").trim();
      if (nome) chaves.push(normNome(nome));
    }
    if (chaves.length > 0 && !chaves.some((c) => usados.has(c))) naoEncontrados++;
  }

  const avisos: string[] = [];
  if (ambiguos.size > 0) {
    avisos.push(
      `${ambiguos.size} produto(s) casaram com mais de um custo diferente e ficaram de fora — ` +
        `escolher um por conta própria gravaria custo errado. Eles estão listados abaixo para você decidir.`
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
    detalhesAmbiguos: [...ambiguos.entries()].map(([produtoId, v]) => ({
      produtoId,
      produto: v.produto,
      candidatos: v.candidatos,
    })),
    ...(avisos.length > 0 ? { aviso: avisos.join(" ") } : {}),
  };
}

/**
 * Grava o custo que o LOJISTA definiu, produto a produto.
 *
 * Duas portas chegam aqui, e as duas são a mesma decisão — uma pessoa dizendo
 * quanto custa este item:
 *
 *   1. a caixa de ambíguos, quando a planilha traz custos diferentes para o
 *      mesmo produto e não há resposta certa para escolher sozinho;
 *   2. a caixa de custo na tela de Precificação, para os produtos que a planilha
 *      não alcança — títulos de marketing do ML contra nomes de ERP, 71% de
 *      semelhança, abaixo do limiar de 85%. Baixar o limiar não é saída: foi com
 *      83% que o custo de um sapato foi parar em outro modelo.
 *
 * `confiancaCusto: "alta"` nos dois casos, e é honesto: veio de quem compra.
 *
 * O custo desce para as variações do produto, como na importação: a variação
 * sem custo próprio herda o do pai, e é dela que a precificação lê.
 *
 * NÃO grava `precoMinimo`. A coluna guarda o resultado da fórmula antiga, sem
 * peso e sem frete — foi ela que deixou 1.733 produtos com R$ 1,77 de piso, o
 * mesmo valor para tênis, mochila e slime. A tela calcula o piso ao vivo, com o
 * peso real; escrever ali de novo seria recriar o fantasma que a migração 030
 * apagou.
 */
export async function definirCustoEscolhido(
  clienteId: string,
  produtoId: string,
  custo: number
): Promise<{ variantes: number }> {
  if (!(custo > 0)) return { variantes: 0 };

  const produtos = await listarProdutosDoCliente(clienteId);
  const produto = produtos.find((p) => p.id === produtoId);
  if (!produto) return { variantes: 0 };

  await atualizarProdutosBulk([
    {
      id: produtoId,
      custo,
      // ?? undefined: margem desconhecida some do registro em vez de virar 0,
      // que o resto do sistema leria como "sem margem nenhuma".
      margem: margemZion(custo, produto.precoVenda) ?? undefined,
      confiancaCusto: "alta",
    },
  ]);

  const variantes = (await listarTodasVariantes()).filter(
    (v) => v.clienteId === clienteId && v.produtoId === produtoId
  );
  if (variantes.length > 0) {
    await atualizarVariantesBulk(variantes.map((v) => ({ id: v.id, custo })));
  }
  return { variantes: variantes.length };
}
