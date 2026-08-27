// Importação de custos E PREÇOS em massa (planilha CSV/Excel).
//
// Casa cada linha por:
//   1) SKU  → variação e/ou SKU pai/codErp;
//   2) NOME do produto → exato (normalizado) e, se não achar, o mais parecido
//      por sobreposição de palavras.
// Grava custo e/ou preço de venda, cada um só quando a coluna veio, e propaga
// para as variações do produto.
//
// ===========================================================================
// O PREÇO ENTROU EM 26/08/2026, E A MARGEM CONTINUA SAINDO VAZIA
// ===========================================================================
//
// O cabeçalho dizia "recalcula margem e preço mínimo (modelo Zion)". Medido: os
// dois saem SEMPRE `null`. `margemZion` e `precoMinimoZion` usam `TAXAS_PADRAO`,
// cuja `embalagem` é `null` — sem embalagem não há frete estimável, sem frete
// não há lucro, sem lucro não há margem.
//
// Não é teoria: na base de produção, 72 produtos, 72 com custo, ZERO com margem
// e ZERO com preço mínimo gravados. As colunas nunca receberam valor por aqui.
//
// Isto NÃO é um defeito consertado neste commit — a tela de precificação calcula
// os dois ao vivo, com o peso do produto, e é ela que a lojista lê. O que muda é
// o cabeçalho parar de prometer o que não entrega. Ver o teste que registra a
// medição em `importacaoCustos.test.ts`.

import type { PlanilhaLida } from "../planilha";
import {
  colunaDoPapel,
  sugerirMapeamento,
  type Mapeamento,
} from "../../modules/catalog/domain/mapeamentoPlanilha";
import { parseNumeroCusto } from "../../modules/pricing/domain/custoDigitado";
import {
  capturarDecisao,
  type DecisionJournal,
} from "../../modules/adaptive-intelligence/decision-journal.ts";
import { autorAtual } from "../auth/autorAtual";
import { listarProdutosDoCliente, atualizarProdutosBulk } from "./produtos";
import { listarTodasVariantes, atualizarVariantesBulk } from "./produtoVariantes";
import { margemZion, precoMinimoZion } from "./importacaoProdutos";
import type { Produto, ProdutoVariante } from "../types";

/**
 * O que uma linha da planilha traz. Zero quer dizer "a coluna não veio, ou não
 * era número" — e nunca "o valor é zero", porque custo zero e preço zero não
 * existem num catálogo e gravá-los apagaria o que já estava certo.
 */
export interface NumerosDaLinha {
  custo: number;
  preco: number;
  /**
   * Quantidade. `-1` = a coluna não veio.
   *
   * ZERO É UM VALOR LEGÍTIMO AQUI, e é o que separa estoque de dinheiro.
   * Custo zero e preço zero não existem num catálogo; estoque zero existe o
   * tempo todo, e é justamente o que a lojista precisa gravar quando esgota.
   * Por isso a ausência não pode ser marcada com 0 — ela é `-1`.
   */
  estoque: number;
}

/** O que dizer "a coluna não veio" para cada número. */
export const SEM_VALOR: NumerosDaLinha = { custo: 0, preco: 0, estoque: -1 };

/**
 * O que gravar num PRODUTO a partir de uma linha da planilha.
 *
 * ===========================================================================
 * ZERO NÃO APAGA
 * ===========================================================================
 *
 * Zero aqui quer dizer "a coluna não veio", nunca "o valor é zero". Uma
 * planilha só de preço não pode zerar o custo que já estava certo, e o
 * contrário também não — por isso cada campo entra SÓ quando tem valor, e o
 * update vai parcial.
 *
 * ===========================================================================
 * A MARGEM SEMPRE, PORQUE ELA DEPENDE DOS DOIS
 * ===========================================================================
 *
 * Enquanto só o custo entrava por aqui, `margemZion(custo, p.precoVenda)`
 * bastava. Com o preço entrando, uma planilha só de preço muda a margem de todo
 * produto que já tinha custo — e deixar a margem velha seria a tela mostrando
 * um número que a própria importação acabou de desmentir.
 *
 * `?? undefined`: margem desconhecida SOME do registro em vez de virar 0, que o
 * resto do sistema leria como "sem margem nenhuma".
 */
export function camposDoProduto(
  valores: NumerosDaLinha,
  atual: { custo: number; precoVenda: number }
): Partial<Produto> {
  // O ESTOQUE DO PRODUTO NÃO ENTRA AQUI, e a ausência é decisão.
  //
  // Ele é a SOMA das variações, não um valor próprio — a planilha traz o saldo
  // de cada SKU. Gravar aqui o número de uma linha faria o produto afirmar o
  // estoque de UMA variação como se fosse o dele. A soma é feita depois, quando
  // já se sabe o que cada variação ficou valendo.
  const custoEfetivo = valores.custo > 0 ? valores.custo : atual.custo;
  const precoEfetivo = valores.preco > 0 ? valores.preco : atual.precoVenda;
  return {
    ...(valores.custo > 0
      ? {
          custo: valores.custo,
          precoMinimo: precoMinimoZion(valores.custo) ?? undefined,
          confiancaCusto: "alta" as const,
        }
      : {}),
    ...(valores.preco > 0 ? { precoVenda: valores.preco } : {}),
    margem: margemZion(custoEfetivo, precoEfetivo) ?? undefined,
  };
}

/** O mesmo para a VARIAÇÃO, que guarda `precoBase` no lugar de `precoVenda`. */
export function camposDaVariante(valores: NumerosDaLinha): Partial<ProdutoVariante> {
  return {
    ...(valores.custo > 0 ? { custo: valores.custo } : {}),
    ...(valores.preco > 0 ? { precoBase: valores.preco } : {}),
    // `>= 0` e não `> 0`: zero é "esgotou", e esgotou é informação.
    ...(valores.estoque >= 0 ? { estoque: valores.estoque } : {}),
  };
}

export interface ResultadoCustos {
  produtos: number;
  /** Quantos produtos receberam PREÇO DE VENDA (subconjunto de `produtos`). */
  precos: number;
  /** Quantos produtos tiveram o ESTOQUE recalculado (subconjunto de `produtos`). */
  estoques: number;
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

/**
 * De quantos em quantos produtos a importação devolve o fio ao navegador.
 *
 * Vinte e cinco porque o casamento por nome custa ~5,7 ms por produto no caso
 * medido: são ~140 ms entre pausas, abaixo do limite em que a aba parece presa.
 * Pausar a cada um multiplicaria as idas ao agendador sem ganho perceptível.
 */
const PRODUTOS_ENTRE_PAUSAS = 25;

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
  valores: NumerosDaLinha;
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
/**
 * QUANTOS produtos cada linha da planilha vai atingir, PELO NOME.
 *
 * ===========================================================================
 * O CASO QUE PRODUZIU ISTO
 * ===========================================================================
 *
 * Medido em 10/08/2026, importando duas linhas na conta real: o relatório disse
 * "3 produto(s)". A linha era "Babuche Yvate **Feminina** Eva 1816 Conforto" e
 * `mesmaIdentidade` casou também com o **Masculino** — mesmo modelo, mesma
 * numeração, uma palavra de diferença.
 *
 * Naquele caso os dois tinham o mesmo custo e não houve estrago. Foi sorte: uma
 * planilha com "Feminina — R$ 31,00" daria 31,00 ao Masculino, calado.
 *
 * O importador já recusa o CONFLITO (duas linhas brigando pelo mesmo produto,
 * com custos diferentes). O oposto — uma linha se espalhando por produtos
 * demais — passava sem nenhum aviso, porque do ponto de vista dele nada está
 * em disputa.
 *
 * ===========================================================================
 * POR QUE MOSTRAR EM VEZ DE RECUSAR
 * ===========================================================================
 *
 * Espalhar às vezes é o que ela QUER: o mesmo modelo em várias cores, uma linha
 * de custo para todos. Recusar transformaria o caso legítimo em trabalho
 * manual. Mostrar deixa a decisão com quem conhece o catálogo — que é a mesma
 * razão de `ConferirPlanilha` existir.
 *
 * ===========================================================================
 * A MESMA REGRA DA IMPORTAÇÃO, NÃO UMA PARECIDA
 * ===========================================================================
 *
 * Usa `normNome` e `mesmaIdentidade` — as funções que `custoPorNome` usa lá
 * embaixo. Uma segunda regra de casamento divergiria em silêncio e a prévia
 * passaria a prometer um alcance que a gravação não cumpre, que é pior que não
 * mostrar nada.
 *
 * SÓ O NOME: quem casa por SKU ou EAN atinge a variante exata, e ali não há
 * espalhamento a avisar. Quem lê precisa saber disso para não ler "nenhum"
 * como "esta linha não vai gravar" numa planilha que casa por SKU.
 *
 * ===========================================================================
 * DEVOLVE TODAS AS LINHAS, INCLUSIVE AS DE ZERO
 * ===========================================================================
 *
 * A primeira versão só registrava `> 1`, e a tela mostrava "1 produto" como
 * padrão para o que não estava no mapa. Resultado medido em 10/08/2026: uma
 * linha de "Sapato Fantasma Que Nao Existe No Catalogo" aparecia como
 * "1 produto" — como se fosse cair em algum lugar. Confundir ZERO com UM é o
 * oposto do que esta coluna existe para fazer.
 *
 * Zero é a informação mais útil das três: é a linha que não vai gravar nada, e
 * saber disso ANTES vale mais que o `naoEncontrados` do relatório depois.
 */
export function alcancePorNome(
  linhas: readonly Record<string, string>[],
  colunaNome: string | null,
  nomesDoCatalogo: readonly string[]
): Map<number, string[]> {
  const alcance = new Map<number, string[]>();
  if (!colunaNome) return alcance;

  linhas.forEach((row, i) => {
    const daPlanilha = (row[colunaNome] ?? "").trim();
    // Linha sem nome não é "zero produtos": é linha que não usa este caminho.
    // Ficar de fora do mapa é o certo — a tela não afirma nada sobre ela.
    if (!daPlanilha) return;
    const exato = normNome(daPlanilha);
    alcance.set(
      i,
      nomesDoCatalogo.filter((n) => normNome(n) === exato || mesmaIdentidade(daPlanilha, n))
    );
  });
  return alcance;
}

/** O que a lojista decidiu na conferência, além do mapa de colunas. */
export interface OpcoesDeImportacao {
  /**
   * Quantos dígitos o SKU do catálogo tem A MAIS que o código da planilha.
   *
   * Só entra quando ela CONFIRMOU o padrão na tela — ver
   * `modules/catalog/domain/casamentoPorPrefixo`. Ausente é o comportamento de
   * sempre: SKU casa por igualdade e mais nada.
   *
   * Não é default e não pode virar: "tira os dois últimos dígitos" é a
   * convenção do ERP dela, não uma verdade sobre SKUs, e aplicá-la sozinho num
   * catálogo de outro formato gravaria custo errado em silêncio.
   */
  sufixoDoSku?: number;
}

export async function importarCustos(
  clienteId: string,
  planilha: PlanilhaLida,
  mapa?: Mapeamento,
  opcoes?: OpcoesDeImportacao
): Promise<ResultadoCustos> {
  const { headers, linhas } = planilha;
  const mapeamento = mapa ?? sugerirMapeamento(headers);
  const hSku = colunaDoPapel(mapeamento, "sku");
  const hNome = colunaDoPapel(mapeamento, "nome");
  const hEan = colunaDoPapel(mapeamento, "ean");
  const hCusto = colunaDoPapel(mapeamento, "custo");
  // O PREÇO DE VENDA, QUE A TELA JÁ OFERECIA E NINGUÉM LIA.
  //
  // `PAPEIS` sempre teve "precoVenda" e `ConferirPlanilha` sempre mostrou
  // "Preço de venda" no seletor. Esta função lia só o custo — quem mapeasse a
  // coluna de preço via a planilha ser aceita e o preço sumir, calado.
  //
  // Isso importa porque o preço trava a publicação: medido em 26/08/2026, os
  // 1003 produtos de uma base recém-importada estavam com `preco_venda = 0`, e
  // o Mercado Livre não aceita anúncio sem preço. A exportação de derivações do
  // ERP não tem coluna de preço nenhuma — ele vem em outro relatório, e é por
  // esta porta que ele entra.
  const hPreco = colunaDoPapel(mapeamento, "precoVenda");
  // O ESTOQUE ENTRA PELA MESMA PORTA — 27/08/2026.
  //
  // O Mercado Livre não aceita anúncio com quantidade zero, e a exportação de
  // derivações do ERP veio com as 7224 linhas zeradas. O saldo vem em outro
  // relatório, e ele casa com o mesmo SKU que o custo e o preço já casam.
  const hEstoque = colunaDoPapel(mapeamento, "estoque");
  if ((!hCusto && !hPreco && !hEstoque) || (!hSku && !hNome && !hEan)) {
    return {
      produtos: 0,
      precos: 0,
      estoques: 0,
      variantes: 0,
      naoEncontrados: 0,
      linhasCsv: linhas.length,
      ambiguos: 0,
      detalhesAmbiguos: [],
      aviso:
        "A planilha precisa de 'custo', 'preço de venda' e/ou 'estoque', e de 'sku', 'ean' e/ou 'nome/produto'.",
    };
  }

  const porSku = new Map<string, NumerosDaLinha>();
  const porEan = new Map<string, NumerosDaLinha>();
  const porNomeExato = new Map<string, { valores: NumerosDaLinha; original: string }[]>();
  const entradasNome: EntradaNome[] = [];
  for (const row of linhas) {
    // Custo e preço viajam JUNTOS a partir daqui. Vieram da mesma linha, e
    // separá-los abriria a porta para o custo de um produto encontrar o preço
    // de outro.
    const custo = hCusto ? parseNumeroCusto(row[hCusto] ?? "") : 0;
    const preco = hPreco ? parseNumeroCusto(row[hPreco] ?? "") : 0;
    // Zero é saldo legítimo, então a ausência precisa de outro sinal: célula
    // vazia (ou não numérica) vira -1, e -1 quer dizer "não veio".
    const bruto = hEstoque ? (row[hEstoque] ?? "").trim() : "";
    const estoque = bruto === "" ? -1 : Math.max(0, Math.trunc(parseNumeroCusto(bruto)));
    if (custo <= 0 && preco <= 0 && estoque < 0) continue;
    const valores: NumerosDaLinha = { custo, preco, estoque };
    if (hSku) {
      const sku = norm(row[hSku] ?? "");
      if (sku) {
        porSku.set(sku, valores);
        const z = semZeros(sku);
        if (z && z !== sku) porSku.set(z, valores);
      }
    }
    if (hEan) {
      const ean = (row[hEan] ?? "").replace(/\D/g, "");
      if (ean) porEan.set(ean, valores);
    }
    if (hNome) {
      const nome = (row[hNome] ?? "").trim();
      if (nome) {
        // TODOS os custos daquele nome, não o último.
        //
        // Era `porNomeExato.set(chave, custo)` — um `Map`. Duas linhas com o
        // MESMO nome e custos diferentes faziam o segundo `set` sobrescrever o
        // primeiro, calado, e `custoPorNome` consultava este mapa ANTES da
        // detecção de ambiguidade. Resultado: a guarda de conflito só valia
        // para nomes PARECIDOS; para nomes idênticos o último vencia.
        //
        // Medido em 10/08/2026 forjando uma planilha suja: duas linhas de
        // "Babuche Molekinha Arco Iris 22591.408" com 54,16 e 61,90 gravaram
        // 61,90 e reportaram ZERO ambíguos. E nome repetido é a forma MAIS
        // comum de planilha suja — o mesmo produto listado duas vezes, com o
        // preço velho e o novo.
        const chave = normNome(nome);
        const jaVistos = porNomeExato.get(chave) ?? [];
        jaVistos.push({ valores, original: nome });
        porNomeExato.set(chave, jaVistos);
        entradasNome.push({ palavras: palavras(nome), valores, original: nome });
      }
    }
  }
  if (porSku.size === 0 && porEan.size === 0 && porNomeExato.size === 0) {
    return {
      produtos: 0, precos: 0, estoques: 0, variantes: 0, naoEncontrados: 0, linhasCsv: linhas.length, ambiguos: 0,
      detalhesAmbiguos: [],
      aviso: "Nenhum número válido na planilha. Confira se a coluna de custo ou de preço tem números.",
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
  const custosPorProduto = new Map<string, NumerosDaLinha[]>();
  const usados = new Set<string>();
  /** Produtos que casaram com mais de um custo — não se escolhe por conta própria. */
  const ambiguos = new Map<string, { produto: string; candidatos: { custo: number; origem: string }[] }>();

  // 1) Variações por SKU ou EAN.
  for (const v of todasVar) {
    const skuV = norm(v.sku);
    let c = porSku.get(skuV) ?? porSku.get(semZeros(skuV));
    if (c != null) usados.add(skuV);

    // O CÓDIGO DA PLANILHA É O SKU SEM O TAMANHO — só quando ela confirmou.
    //
    // O LINX identifica o item por código de 6 dígitos ("006427"); o SKU da
    // variação aqui é esse código mais o número do calçado ("00642743"). Sem
    // isto, 26 de 26 códigos existiam no arquivo e nenhum casava.
    //
    // `usados.add(raiz)` e não `skuV`: quem conta `naoEncontrados` olha a chave
    // da LINHA da planilha, que é a raiz. Marcar o SKU da variação deixaria a
    // linha contada como "sem produto" depois de ter gravado — um relatório que
    // se contradiz treina a pessoa a ignorar o relatório.
    const sufixo = opcoes?.sufixoDoSku;
    if (c == null && sufixo && skuV.length > sufixo && /^\d+$/.test(skuV.slice(-sufixo))) {
      const raiz = skuV.slice(0, -sufixo);
      const porRaiz = porSku.get(raiz) ?? porSku.get(semZeros(raiz));
      if (porRaiz != null) {
        c = porRaiz;
        usados.add(raiz);
      }
    }
    if (c == null && v.ean) {
      const ean = v.ean.replace(/\D/g, "");
      c = porEan.get(ean);
      if (c != null) usados.add(ean);
    }
    if (c == null) continue;
    idVarCasada.add(v.id);
    // SÓ o que veio. Uma planilha só de preço não pode zerar o custo que já
    // estava lá, e vice-versa — zero aqui quer dizer "a coluna não veio".
    varAtualizadas.push({ id: v.id, ...camposDaVariante(c) });
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
  function valoresPorNome(nomeProduto: string, produtoId: string): NumerosDaLinha | null {
    const exatos = porNomeExato.get(normNome(nomeProduto));
    if (exatos && exatos.length > 0) {
      // Distintos pelo PAR: duas linhas com o mesmo custo e preços diferentes
      // também são um conflito, e gravar uma delas seria escolher no escuro.
      const distintos = [
        ...new Map(exatos.map((e) => [`${e.valores.custo}|${e.valores.preco}`, e])).values(),
      ];
      // Nome IDÊNTICO com custos diferentes é conflito, e recusar aqui é a
      // mesma decisão que o caminho aproximado já tomava logo abaixo.
      if (distintos.length > 1) {
        ambiguos.set(produtoId, {
          produto: nomeProduto,
          candidatos: distintos.map((d) => ({ custo: d.valores.custo, origem: d.original })),
        });
        return null;
      }
      return distintos[0].valores;
    }

    const candidatos = entradasNome.filter((e) => mesmaIdentidade(e.original, nomeProduto));
    if (candidatos.length === 0) return null;

    const custos = new Set(candidatos.map((c) => `${c.valores.custo}|${c.valores.preco}`));
    if (custos.size > 1) {
      // Duas linhas brigando pelo mesmo produto. Guarda QUAIS, para a tela
      // poder mostrar e a pessoa decidir — recusar em silêncio só empurra o
      // problema para um lugar onde ninguém o vê.
      const vistos = new Set<string>();
      const distintos: { custo: number; origem: string }[] = [];
      for (const c of candidatos) {
        const chave = `${c.valores.custo}|${c.valores.preco}`;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        distintos.push({ custo: c.valores.custo, origem: c.original });
      }
      ambiguos.set(produtoId, { produto: nomeProduto, candidatos: distintos });
      return null;
    }
    return candidatos[0].valores;
  }

  // 2) Produtos: SKU/codErp → VARIAÇÕES casadas por SKU → NOME.
  //
  // ===========================================================================
  // A ORDEM MUDOU EM 17/08/2026, E O MOTIVO É UM NÚMERO ERRADO NA BASE REAL
  // ===========================================================================
  //
  // O nome vinha ANTES das variações. Isso põe o sinal FRACO na frente do
  // FORTE: SKU é identidade exata, nome é semelhança de 85%.
  //
  // O que aconteceu, medido na conta dela ao importar o `TABELA CUSTOS LINX`:
  //
  //   · "Chinelo Havaianas Masculino Top Max Comfort Original" tem 18 variações
  //     nos códigos 006426/006427 (28,79), 006428 (36,01), 010100 (32,99) e
  //     010101 (92,58);
  //   · o nome casou, com 85,7%, com OUTRO item do arquivo — "CHINELO DEDO
  //     MASCULINO HAVAIANAS TOP MAX COMFORT I", código 010810, custo 34,03;
  //   · as 18 variações ficaram com 34,03, um valor que não é de nenhuma delas.
  //
  // Foi o ÚNICO dos 29 produtos gravados que divergiu do LINX. Os outros 28
  // bateram exatamente — o que mostra que o problema não é o casamento por
  // nome existir, é ele decidir quando já existe resposta melhor.
  //
  // Baixar o limiar de 85% não é o conserto (foi com 83% que o custo de um
  // tênis foi parar em outro modelo), e subir quebraria os casos legítimos. O
  // conserto é a PRECEDÊNCIA: quem casou por SKU já respondeu.
  const prodAtualizados: (Partial<Produto> & { id: string })[] = [];
  let precosGravados = 0;
  const produtosComEstoque = new Set<string>();
  let desdeAPausa = 0;
  for (const p of produtos) {
    // CEDER O FIO — 27/08/2026.
    //
    // O casamento por NOME é O(n × m): cada produto sem código varre a planilha
    // inteira chamando `mesmaIdentidade`. Medido com os arquivos reais — 1003
    // produtos contra 1505 linhas — são 1,5 MILHÃO de comparações e 5,7
    // segundos de laço SÍNCRONO.
    //
    // No navegador isso congela a aba: o fio principal não desenha, não responde
    // ao clique, e o Chrome oferece "fechar a página". Quem recarrega nesse
    // intervalo interrompe a importação no meio — foi o que deixou 661 variações
    // gravadas e 182 produtos sem nada, duas vezes seguidas.
    //
    // A pausa não acelera nada: ela devolve o controle ao navegador de tempos em
    // tempos, e a aba continua viva enquanto a conta roda. Trabalho longo que
    // não cede o fio é trabalho que a pessoa não consegue esperar.
    if (++desdeAPausa >= PRODUTOS_ENTRE_PAUSAS) {
      desdeAPausa = 0;
      await new Promise((r) => setTimeout(r, 0));
    }
    let valores = porSku.get(norm(p.sku)) ?? porSku.get(semZeros(norm(p.sku)));
    if (valores != null) usados.add(norm(p.sku));
    if (valores == null && p.codErp) {
      valores = porSku.get(norm(p.codErp)) ?? porSku.get(semZeros(norm(p.codErp)));
      if (valores != null) usados.add(norm(p.codErp));
    }
    // AS VARIAÇÕES QUE JÁ CASARAM POR SKU/EAN — antes do nome.
    //
    // `Math.min` continua sendo o resumo do produto, como sempre foi: a coluna
    // é um retrato, e o preço mínimo tem que caber no item mais barato.
    if (valores == null) {
      const cs = custosPorProduto.get(p.id);
      // O PAR INTEIRO da variação mais barata, não o menor custo com o menor
      // preço. `Math.min` continua sendo o resumo do custo — o preço mínimo tem
      // que caber no item mais barato —, e o preço vem da MESMA linha, porque
      // misturar linhas é como o custo de um produto acha o preço de outro.
      if (cs && cs.length > 0) {
        const comCusto = cs.filter((c) => c.custo > 0);
        valores =
          comCusto.length > 0
            ? comCusto.reduce((a, b) => (b.custo < a.custo ? b : a))
            : cs.reduce((a, b) => (b.preco < a.preco ? b : a));
      }
    }
    let porNome = false;
    if (valores == null && hNome) {
      const c = valoresPorNome(p.nome, p.id);
      if (c != null) {
        valores = c;
        porNome = true;
      }
    }
    if (valores == null || (valores.custo <= 0 && valores.preco <= 0 && valores.estoque < 0)) continue;

    if (valores.preco > 0) precosGravados++;
    prodAtualizados.push({ id: p.id, ...camposDoProduto(valores, p) });
    if (valores.estoque >= 0) produtosComEstoque.add(p.id);
    if (porNome) usados.add(normNome(p.nome));

    // Propaga para as variações ainda não casadas por SKU — os dois números,
    // cada um só quando veio.
    for (const v of varsPorProduto.get(p.id) ?? []) {
      if (!idVarCasada.has(v.id)) {
        idVarCasada.add(v.id);
        varAtualizadas.push({ id: v.id, ...camposDaVariante(valores) });
      }
    }
  }

  // O ESTOQUE DO PRODUTO É A SOMA DAS VARIAÇÕES, RECALCULADA AQUI.
  //
  // É a única diferença real entre estoque e dinheiro nesta importação. Custo e
  // preço do produto são um RESUMO (o menor custo, o preço da mesma linha);
  // estoque é uma CONTA — 3 do 35 mais 2 do 36 são 5, e nenhum dos dois é o
  // número do produto.
  //
  // A soma usa o valor NOVO onde a planilha o trouxe e o que já estava nas
  // outras. Só entra nos produtos que receberam algum estoque: recalcular quem
  // a planilha não tocou seria reescrever, com o mesmo número, uma linha que
  // ninguém pediu para mudar.
  const novoEstoqueDaVariante = new Map<string, number>();
  for (const v of varAtualizadas) {
    if (typeof v.estoque === "number") novoEstoqueDaVariante.set(v.id, v.estoque);
  }
  for (const id of produtosComEstoque) {
    const soma = (varsPorProduto.get(id) ?? []).reduce(
      (t, v) => t + (novoEstoqueDaVariante.get(v.id) ?? v.estoque ?? 0),
      0
    );
    const linha = prodAtualizados.find((x) => x.id === id);
    if (linha) linha.estoque = soma;
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
    const preco = hPreco ? parseNumeroCusto(row[hPreco] ?? "") : 0;
    const temEstoque = hEstoque ? (row[hEstoque] ?? "").trim() !== "" : false;
    // Linha sem número nenhum não é "produto não encontrado" — ela não pediu
    // nada. Com preço e sem custo, pediu. Com estoque zero, também pediu.
    if (custo <= 0 && preco <= 0 && !temEstoque) continue;
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
    precos: precosGravados,
    estoques: produtosComEstoque.size,
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
  custo: number,
  journal?: DecisionJournal
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

  // ── Observador lateral · Signal Source CUSTO (AIL) ────────────────────────
  //
  // Esta função é o funil das duas decisões HUMANAS de custo — a escolha na
  // caixa de ambíguos e o valor digitado na Precificação. As duas passam as
  // cinco perguntas de admissão do AIL_SIGNAL_MAP: é decisão de pessoa, tem
  // delta observável, repete, e capturar não muda comportamento nenhum.
  //
  // A importação em massa NÃO passa aqui, e é de propósito: o mapa de sinais já
  // decidiu que "execuções autônomas não são Decisions". Além disso cada captura
  // é um upsert próprio — 1.806 linhas de planilha virariam 1.806 gravações
  // laterais numa importação que o lojista já achou lenta.
  //
  // Depois da gravação, não antes: só se registra o que de fato aconteceu.
  // `String()` para casar com a forma canônica de `produtos.valorObservado`, e
  // assim os dois caminhos produzirem registros comparáveis.
  capturarDecisao(
    {
      empresa: clienteId,
      contexto: "precificacao",
      entidade: { tipo: "produto", id: produtoId },
      campo: "custo",
      valorAnterior: produto.custo > 0 ? String(produto.custo) : null,
      valorNovo: String(custo),
      origem: "importacaoCustos.definirCustoEscolhido",
      autor: await autorAtual(),
    },
    journal
  );

  const variantes = (await listarTodasVariantes()).filter(
    (v) => v.clienteId === clienteId && v.produtoId === produtoId
  );
  if (variantes.length > 0) {
    await atualizarVariantesBulk(variantes.map((v) => ({ id: v.id, custo })));
  }
  return { variantes: variantes.length };
}
