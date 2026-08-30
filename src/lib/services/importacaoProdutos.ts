// Importação da BASE DE PRODUTOS (CSV/planilha) → tabela produtos.
//
// Mesmo motor do importador de auditorias: parser próprio, reconhecimento de
// colunas tolerante a acento/caixa, prévia e gravação em lote. Alimenta a
// Esteira de Anúncio (Fase 1).

import { parseCsv, normalizarHeader } from "../csv";
import { MARKETPLACES } from "../constantes";
import type { Marketplace, Produto, ProdutoAtributo, ProdutoVariante } from "../types";
import { criarProdutos } from "./produtos";
import { criarVariantesBulk } from "./produtoVariantes";
import { criarAtributosBulk } from "./produtoAtributos";
import { atributosParaOCadastro } from "../../modules/publication/domain/composicaoConteudo.ts";
import {
  margemLiquida,
  precoMinimoOuNull,
  MARGEM_MINIMA_PADRAO,
} from "../../modules/pricing/domain/modeloPreco.ts";
import {
  avisoDeGradeAchatada,
  type AvisoDeGrade,
} from "../../modules/catalog/domain/gradeAchatada.ts";
import {
  avisoDePesoImplausivel,
  type AvisoDePeso,
} from "../../modules/catalog/domain/pesoImplausivel.ts";
import {
  avisoDeCodigoQueEPalavra,
  type AvisoDeCodigo,
} from "../../modules/catalog/domain/codigoQueEPalavra.ts";
import { nomeSemDerivacao } from "../../modules/catalog/domain/nomeSemDerivacao.ts";
import { partesDaDerivacao } from "../../modules/catalog/domain/tamanhoDaDerivacao.ts";
import {
  corDaDerivacao,
  vocabularioDeCores,
  type AmostraDeCor,
} from "../../modules/catalog/domain/corDaDerivacao.ts";

// ---- Colunas canônicas e aliases ----

const ALIASES: Record<string, string> = {
  nome: "nome", produto: "nome", titulo: "nome", nome_do_produto: "nome", descricao_produto: "nome", item: "nome",
  marca: "marca", brand: "marca", fabricante: "marca",
  modelo: "modelo", model: "modelo", ref: "modelo", referencia: "modelo", codigo_modelo: "modelo",
  categoria: "categoria", category: "categoria", departamento: "categoria",
  sku: "sku", codigo: "sku", cod: "sku", codigo_interno: "sku", id: "sku",
  cor: "cor", color: "cor",
  // A coluna que o Magazord traz preenchida em 94% das linhas — ver
  // `atributosDasPalavrasChave`. Não vira campo do produto: vira `produto_atributos`.
  palavras_chave: "palavrasChave", palavraschave: "palavrasChave",
  palavras: "palavrasChave", keywords: "palavrasChave", tags: "palavrasChave",
  tamanho: "tamanho", size: "tamanho", numeracao: "tamanho", numero: "tamanho", grade: "tamanho",
  custo: "custo", custo_unitario: "custo", preco_custo: "custo", preco_de_custo: "custo", valor_de_custo: "custo", custo_medio: "custo", custo_linx: "custo", custo_compra: "custo",
  preco: "precoVenda", preco_venda: "precoVenda", precovenda: "precoVenda", preco_de_venda: "precoVenda", valor_unitario: "precoVenda", price: "precoVenda", valor: "precoVenda", preco_atual: "precoVenda",
  // Bling/Tiny usam "Descrição" como nome do produto na exportação.
  descricao: "nome", descrição: "nome",
  estoque: "estoque", stock: "estoque", quantidade: "estoque", qtd: "estoque", saldo: "estoque", saldo_estoque: "estoque", estoque_disponivel: "estoque", qtde_estoque: "estoque",
  // MEDIDO EM 26/08/2026, no T1, com uma exportação real do Magazord: o
  // `autoMapear` resolvia 6 de 15 campos e falhava no OBRIGATÓRIO `nome` — era
  // por isso que a tela pedia para escolher coluna a coluna. `produto_derivacao`
  // é a única coluna daquela planilha que carrega o nome do produto.
  //
  produto_derivacao: "nome",
  // `nome_da_derivacao` NÃO vira o nome — vira a PROVA de onde o nome acaba.
  //
  // Mapeá-la como `nome` batizaria cada produto pela variação, que é o erro que
  // rachou sete produtos em quatorze em 19/08. Mas descartá-la também custou:
  // sem ela, o nome do produto saía com a derivação colada no fim.
  // Medido em 26/08: em 7223 de 7224 linhas o valor de `Produto - Derivação`
  // termina exatamente com o de `Nome da Derivação`, e é assim que o nome do
  // produto é recortado sem adivinhar onde cortar. Ver `nomeSemDerivacao`.
  nome_da_derivacao: "nomeDerivacao",
  // `codigo_agrupador` junta produto + COR e não inclui o tamanho. É por isso
  // que ele prova onde o tamanho começa dentro do nome da derivação — 7211
  // de 7224 linhas, medido em 26/08. Ver `tamanhoDaDerivacao`.
  codigo_agrupador: "agrupador", cod_agrupador: "agrupador",
  // ---- PESO: SÓ COM A UNIDADE NO CABEÇALHO ----
  //
  // A regra é do `importacaoPeso.ts` e está lá desde antes: ele "RECUSA coluna
  // de peso sem unidade no cabeçalho — sem isso não dá para saber se 800 é 800
  // gramas ou 800 quilos". Um `peso` pelado continua sem apelido de propósito.
  //
  // Dimensão é outra história e por isso aceita o nome pelado: o campo de
  // destino é em centímetros e 0,25 ao lado de 25 aparece na amostra da
  // revisão. 800 gramas e 800 quilos são a mesma string.
  peso_kg: "pesoKg", peso_quilos: "pesoKg",
  peso_g: "pesoGramas", peso_gramas: "pesoGramas",
  largura_cm: "larguraCm", largura: "larguraCm",
  altura_cm: "alturaCm", altura: "alturaCm",
  comprimento_cm: "comprimentoCm", comprimento: "comprimentoCm",
  marketplace: "marketplace", canal: "marketplace", plataforma: "marketplace",
  confianca: "confianca", confiabilidade: "confianca", confianca_custo: "confianca",
  cod_erp: "codErp", sku_erp: "codErp", codigo_erp: "codErp",
  cod_magazord: "codErp", magazord: "codErp", codigo_magazord: "codErp", sku_pai: "codErp",
  codigo_pai: "codErp", cod_pai: "codErp", produto_pai: "codErp",
  cod_bling: "codErp", cod_tiny: "codErp", cod_linx: "codErp",
  // Variações (derivações): quando presente, o importador entra no modo agrupado.
  sku_variacao: "skuVariacao", sku_variação: "skuVariacao", sku_deriv: "skuVariacao",
  sku_derivacao: "skuVariacao", cod_derivacao: "skuVariacao", sku_var: "skuVariacao",
  ean: "ean", gtin: "ean", gtin_ean: "ean", codigo_barras: "ean",
  // Id do anúncio no marketplace (MLB) — NÃO é o SKU; vai pro anúncio/variação.
  mlb: "idExterno", mlb_id: "idExterno", id_anuncio: "idExterno", id_ml: "idExterno", id_externo: "idExterno",
};

const COLUNAS = [
  "nome", "marca", "modelo", "categoria", "sku", "cor", "tamanho",
  "custo", "preco", "estoque", "marketplace", "cod_erp", "confianca",
];

// ---- Parsers ----

function parseNumero(s: string): number {
  if (!s) return 0;
  let t = s.replace(/[^\d,.-]/g, "").trim();
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(t);
  return isNaN(n) ? 0 : n;
}
const parseInteiro = (s: string): number => Math.max(0, Math.round(parseNumero(s)));

function resolverMarketplace(valor: string, padrao: Marketplace): Marketplace {
  const v = (valor ?? "").trim().toLowerCase();
  return MARKETPLACES.find((m) => m.toLowerCase() === v) ?? padrao;
}

// A fórmula da margem vive num lugar só: modules/pricing/domain/modeloPreco.
// Estas duas funções continuam existindo porque a IMPORTAÇÃO tira um retrato do
// preço mínimo no momento em que o produto entra — e esse retrato usa o piso
// padrão, não a escolha atual do lojista (que pode mudar depois). Quem exibe
// preço ideal ao vivo chama precoMinimo() com a margem escolhida.

/**
 * Margem % no momento da importação. null quando o frete é desconhecido —
 * gravar 0 diria "sem margem", que é diferente de "ainda não dá para saber".
 */
export function margemZion(custo: number, preco: number): number | null {
  return margemLiquida(custo, preco);
}

/** Preço mínimo no momento da importação, pelo piso padrão. null se indefinido. */
export function precoMinimoZion(custo: number): number | null {
  return precoMinimoOuNull(custo, MARGEM_MINIMA_PADRAO);
}

function normalizarConfianca(v: string): "alta" | "media" | "baixa" | "" {
  const t = (v ?? "").trim().toLowerCase();
  if (t.startsWith("alta") || t === "high") return "alta";
  if (t.startsWith("med") || t === "medium") return "media";
  if (t.startsWith("baix") || t === "low") return "baixa";
  return "";
}

// ---- Tipos ----

export type BaseProduto = Omit<Produto, "id" | "clienteId" | "cliente">;

/** Uma derivação (cor/tamanho) do produto, no modo agrupado. */
export interface VariacaoImportada {
  sku: string; // SKU da derivação (ex.: SKU Variação do ERP)
  cor: string;
  tamanho: string;
  ean: string;
  custo: number;
  precoBase: number;
  estoque: number;
  idExterno: string; // MLB / id do anúncio no marketplace
  // Dimensões e peso da variação. Opcionais porque a planilha do ERP quase
  // nunca os traz — mas um CATÁLOGO traz, e em móvel eles são o produto: é a
  // dimensão que decide o frete e é por ela que o comprador filtra. Eram
  // gravados como 0 sem ninguém ter dito zero.
  alturaCm?: number;
  larguraCm?: number;
  comprimentoCm?: number;
  pesoKg?: number;
}

export interface LinhaProduto {
  base: BaseProduto;
  /** null quando o frete ainda é desconhecido — não é o mesmo que zero. */
  margem: number | null;
  /** Preenchido no modo agrupado (base com variações). */
  variacoes?: VariacaoImportada[];
  /**
   * O texto livre de busca do ERP, quando a planilha o trouxe.
   *
   * NÃO é campo do produto e não é gravado como tal. Serve a uma coisa só:
   * `atributosDasPalavrasChave` lê dali o gênero e o tipo de calçado e os
   * propõe em `produto_atributos`. Ver a função para o porquê.
   */
  palavrasChave?: string;
}

export interface AnaliseProdutos {
  /** "agrupado" quando a planilha traz SKU de variação (produto pai + derivações). */
  modo: "flat" | "agrupado";
  total: number; // nº de PRODUTOS (pais, no modo agrupado)
  totalVariacoes: number;
  colunasReconhecidas: string[];
  colunasIgnoradas: string[];
  faltandoObrigatorias: string[];
  amostra: LinhaProduto[];
  linhas: LinhaProduto[];
  /**
   * O arquivo parece ter grade e vai entrar ACHATADO? `null` quando não há
   * o que avisar.
   *
   * NÃO impede a importação — nome repetido em linhas diferentes é legítimo.
   * Existe porque o modo flat errado não falha: termina em verde e o estrago
   * só aparece semanas depois, com os anúncios já no ar. Ver
   * `modules/catalog/domain/gradeAchatada.ts`.
   */
  avisoDeGrade: AvisoDeGrade | null;
  /**
   * Pesos que o resto da planilha desmente. `null` quando não há o que dizer.
   *
   * NÃO impede a importação e NÃO corrige. Ver
   * `modules/catalog/domain/pesoImplausivel.ts`: 800 kg num chinelo é grama em
   * coluna de quilo, e dividir por mil seria inventar dado.
   */
  avisoDePeso: AvisoDePeso | null;
  /**
   * Palavra no lugar do código. `null` quando não há o que dizer.
   *
   * NÃO impede a importação e NÃO corrige. Medido em 27/08/2026 no catálogo da
   * lojista: 22 de 1003 produtos traziam "inativoo", "iinnattivo", "inatt" e
   * mais dezenove grafias no SKU e no Código do ERP — alguém marcando "fora de
   * linha" no campo do código, com uma letra a mais a cada vez porque o ERP não
   * aceita código repetido. Eles entraram como produto normal, e 19 chegaram a
   * receber foto. Ver `modules/catalog/domain/codigoQueEPalavra.ts`.
   */
  avisoDeCodigo: AvisoDeCodigo | null;
  erro?: string;
}

function mapearColunas(headers: string[]): Record<string, string> {
  const achado: Record<string, string> = {};
  for (const h of headers) {
    const canon = ALIASES[normalizarHeader(h)];
    if (canon && !achado[canon]) achado[canon] = h;
  }

  // ===========================================================================
  // A ASSINATURA DO LINX: `Código` + `Código Pai` juntos
  // ===========================================================================
  //
  // MEDIDO EM 19/08/2026. Sete produtos do ERP viraram QUATORZE no Zion —
  // todos rachados em exatamente dois, o que denuncia regra e não acidente. O
  // Papete Modare 7208.101 (pai 2344016) virou "Chinelo Ortopédico
  // Ultraconforto Laço" E "Papete Slide Modare 7208.101"; o Tênis Loc Salem
  // virou "Calce Fácil Slip On" E "Loc Salem". Cada metade ficou com um pedaço
  // das cores, os estoques divergiram, e 14 variações não puderam receber SKU
  // porque o código "pertencia a outro produto" — que era o mesmo produto.
  //
  // A causa: o export do LINX chama a coluna da derivação de `Código`, e o
  // mapeador não conhecia esse nome. Sem `skuVariacao`, o arquivo inteiro caía
  // em modo FLAT — uma linha, um produto —, e o agrupamento passava a ser pelo
  // NOME DA DERIVAÇÃO, que é escolha de quem digitou.
  //
  // A regra é ESTREITA de propósito. `codigo` sozinho é genérico demais: numa
  // planilha de produtos simples ele é o código do próprio produto, e tratá-lo
  // como derivação forçaria modo agrupado onde não há grade. Só o PAR
  // `Código` + `Código Pai` é assinatura de arquivo com derivação — e aí as
  // duas colunas dizem, juntas, exatamente o que o Zion precisa saber: qual é a
  // unidade e a que produto ela pertence.
  if (!achado["skuVariacao"] && achado["codErp"]) {
    const codigoCru = headers.find((h) => normalizarHeader(h) === "codigo");
    // E não pode ser a MESMA coluna que já virou o pai: `Código Pai` também
    // começa com "codigo", e usar a mesma coluna nos dois papéis faria cada
    // variação ser o próprio pai — um produto por linha, de novo.
    if (codigoCru && codigoCru !== achado["codErp"]) achado["skuVariacao"] = codigoCru;
  }
  return achado;
}

// ---- Assistente de mapeamento de ERP ----

/** Campos canônicos que o cliente pode mapear no assistente (ordem de exibição). */
export const CAMPOS_MAPEAVEIS: {
  campo: string;
  rotulo: string;
  obrigatorio?: boolean;
  dica?: string;
}[] = [
  { campo: "nome", rotulo: "Nome do produto", obrigatorio: true },
  { campo: "custo", rotulo: "Custo" },
  { campo: "precoVenda", rotulo: "Preço de venda" },
  { campo: "estoque", rotulo: "Estoque" },
  { campo: "codErp", rotulo: "SKU/Código do ERP (pai)", dica: "Chave que agrupa as variações" },
  { campo: "skuVariacao", rotulo: "SKU da variação", dica: "Se preenchido, ativa o modo com variações" },
  { campo: "cor", rotulo: "Cor" },
  { campo: "tamanho", rotulo: "Tamanho / Numeração" },
  { campo: "ean", rotulo: "EAN / GTIN" },
  { campo: "marca", rotulo: "Marca" },
  { campo: "modelo", rotulo: "Modelo" },
  { campo: "categoria", rotulo: "Categoria" },
  { campo: "sku", rotulo: "SKU interno" },
  {
    campo: "palavrasChave",
    rotulo: "Palavras-chave",
    dica: "Não vira campo do produto — vira gênero e tipo, para você conferir",
  },
  { campo: "marketplace", rotulo: "Marketplace (opcional)" },
  { campo: "confianca", rotulo: "Confiança do custo" },
  {
    campo: "nomeDerivacao",
    rotulo: "Nome da derivação",
    dica: "Não vira o nome do produto — serve para tirá-la do fim do nome",
  },
  {
    campo: "agrupador",
    rotulo: "Código agrupador",
    dica: "Produto + cor, sem o tamanho — é o que separa o tamanho do resto",
  },
  // ---- PESO E DIMENSÃO: entraram em 26/08/2026, no T1 ----
  //
  // A exportação real do ERP trazia `Peso (kg)`, `Largura (cm)`, `Altura (cm)`
  // e `Comprimento (cm)`, e o importador NÃO TINHA ONDE COLOCAR. Não era falha
  // de mapeamento: o campo não existia.
  //
  // O custo disso está medido em `prontidaoDaLoja.ts`: "73 produtos, 0 com
  // peso, e a precificação inteira muda — sem peso não há frete para produto
  // nenhum". O dado vinha na planilha e era descartado, e a lojista precisava
  // de uma SEGUNDA importação, por outro caminho, para trazer o que já tinha
  // chegado.
  //
  // Os dois pesos são campos separados porque a unidade tem que ser declarada.
  // Preencher os dois é erro de quem mapeia, e a revisão mostra o resultado.
  { campo: "pesoKg", rotulo: "Peso (kg)", dica: "Só se o cabeçalho disser kg" },
  { campo: "pesoGramas", rotulo: "Peso (gramas)", dica: "Só se o cabeçalho disser g" },
  { campo: "larguraCm", rotulo: "Largura (cm)" },
  { campo: "alturaCm", rotulo: "Altura (cm)" },
  { campo: "comprimentoCm", rotulo: "Comprimento (cm)" },
];

/** Lê só o cabeçalho + um valor de exemplo por coluna (para o assistente). */
export function lerCabecalho(texto: string): {
  headers: string[];
  exemplos: Record<string, string>;
} {
  const { headers, linhas } = parseCsv(texto);
  const exemplos: Record<string, string> = {};
  for (const h of headers) {
    exemplos[h] = (linhas.find((r) => (r[h] ?? "").trim())?.[h] ?? "").trim();
  }
  return { headers, exemplos };
}

/** Mapeamento automático (campo canônico → nome da coluna) pelos apelidos. */
export function autoMapear(headers: string[]): Record<string, string> {
  return mapearColunas(headers);
}

/**
 * Presets por ERP: campo canônico → nomes de coluna prováveis (normalizados).
 * Usados como atalho no assistente; o cliente sempre pode ajustar manualmente.
 */
export const PRESETS_ERP: Record<string, Record<string, string[]>> = {
  Bling: {
    nome: ["descricao", "descrição", "produto"],
    sku: ["codigo", "código"],
    custo: ["preco de custo", "preço de custo", "custo"],
    precoVenda: ["preco", "preço", "preco de venda"],
    estoque: ["estoque", "saldo"],
    ean: ["gtin/ean", "gtin", "ean"],
    marca: ["marca"],
    categoria: ["categoria"],
  },
  Tiny: {
    nome: ["descricao", "descrição", "nome"],
    sku: ["codigo", "código", "sku"],
    custo: ["preco de custo", "preço de custo", "custo"],
    precoVenda: ["preco", "preço"],
    estoque: ["estoque", "saldo"],
    ean: ["gtin", "ean"],
    marca: ["marca"],
    categoria: ["categoria"],
  },
  Magazord: {
    codErp: ["sku pai", "codigo pai", "cod pai", "produto pai"],
    skuVariacao: ["sku", "codigo", "cod"],
    nome: ["produto", "descricao", "descrição", "nome"],
    cor: ["cor"],
    tamanho: ["tamanho", "numeracao", "numeração", "numero"],
    custo: ["custo", "preco de custo"],
    precoVenda: ["preco", "preço"],
    estoque: ["estoque", "saldo"],
    ean: ["ean", "gtin"],
  },
};

/** Aplica um preset de ERP sobre as colunas reais da planilha. */
export function aplicarPreset(preset: string, headers: string[]): Record<string, string> {
  const p = PRESETS_ERP[preset];
  const mapa: Record<string, string> = {};
  if (!p) return mapa;
  const alvo = headers.map((h) => ({ h, n: normalizarHeader(h) }));
  for (const [canon, cands] of Object.entries(p)) {
    const cn = cands.map((c) => normalizarHeader(c));
    const hit = alvo.find((a) => cn.includes(a.n));
    if (hit && !Object.values(mapa).includes(hit.h)) mapa[canon] = hit.h;
  }
  return mapa;
}

function mapearLinha(
  rec: Record<string, string>,
  cols: Record<string, string>,
  marketplacePadrao: Marketplace
): LinhaProduto {
  const val = (canon: string) => (cols[canon] ? (rec[cols[canon]] ?? "") : "");

  const custo = parseNumero(val("custo"));
  const precoVenda = parseNumero(val("precoVenda"));
  const margem = margemZion(custo, precoVenda);
  const confiancaCusto = normalizarConfianca(val("confianca"));
  const codErp = val("codErp");

  const palavrasChave = val("palavrasChave").trim();

  const base: BaseProduto = {
    nome: nomeSemDerivacao(val("nome"), val("nomeDerivacao")) || "Produto sem nome",
    marca: val("marca"),
    modelo: val("modelo"),
    categoria: val("categoria"),
    sku: val("sku"),
    cor: val("cor"),
    tamanho: val("tamanho"),
    custo,
    precoVenda,
    estoque: parseInteiro(val("estoque")),
    marketplace: resolverMarketplace(val("marketplace"), marketplacePadrao),
    statusCadastro: "Não iniciado",
    statusSeo: "Pendente",
    statusDescricao: "Pendente",
    statusImagens: "Pendente",
    statusPrecificacao: "Pendente",
    prioridade: "Média",
    observacoes: confiancaCusto && confiancaCusto !== "alta"
      ? `Importado da base. Custo com confiança ${confiancaCusto} — validar antes de reprecificar.`
      : "Importado da base de produtos.",
    codErp: codErp || undefined,
    precoMinimo: precoMinimoZion(custo) ?? undefined,
    margem: margem ?? undefined,
    confiancaCusto,
  };

  // MODO FLAT E O PESO — uma linha, um produto, e nenhuma variação.
  //
  // O banco guarda peso e dimensão em `produto_variantes`, não em `produtos`.
  // Num arquivo sem grade não há variação nenhuma, então o peso que veio na
  // planilha não teria onde ficar — e sumiria em silêncio, que é o defeito que
  // este importador passou o mês arrancando.
  //
  // Quando (e SÓ quando) a linha traz medida, nasce UMA variação para carregá-la.
  // Arquivo sem peso continua saindo exatamente como antes: nenhuma variação,
  // nenhum comportamento novo.
  const medidas = medidasDaLinha(val);
  if (Object.keys(medidas).length === 0) {
    return { base, margem, ...(palavrasChave ? { palavrasChave } : {}) };
  }

  return {
    base,
    margem,
    ...(palavrasChave ? { palavrasChave } : {}),
    variacoes: [
      {
        sku: val("sku"),
        cor: val("cor"),
        tamanho: val("tamanho"),
        ean: val("ean"),
        custo,
        precoBase: precoVenda,
        estoque: parseInteiro(val("estoque")),
        idExterno: val("idExterno"),
        ...medidas,
      },
    ],
  };
}

/**
 * Peso e dimensão de UMA linha, na unidade que o banco guarda.
 *
 * `produto_variantes.peso` é em QUILOS — é o que `copilot_executar_peso` grava
 * (`v_valor / 1000.0`, de gramas para quilos) e o que `confirmarImportacao`
 * escreve direto. A coluna em gramas, quando é ela que veio, é convertida aqui
 * e em nenhum outro lugar.
 *
 * Campo ausente vira `undefined`, não zero: zero é "pesa zero", e a diferença
 * entre "não sei" e "zero" é a que faz `prontidaoDaLoja` saber o que cobrar.
 */
function medidasDaLinha(v: (c: string) => string) {
  const numero = (bruto: string): number | undefined => {
    if (!bruto.trim()) return undefined;
    const n = parseNumero(bruto);
    return n > 0 ? n : undefined;
  };
  const kg = numero(v("pesoKg"));
  const gramas = numero(v("pesoGramas"));
  return {
    ...(kg !== undefined ? { pesoKg: kg } : gramas !== undefined ? { pesoKg: gramas / 1000 } : {}),
    ...(numero(v("larguraCm")) !== undefined ? { larguraCm: numero(v("larguraCm")) } : {}),
    ...(numero(v("alturaCm")) !== undefined ? { alturaCm: numero(v("alturaCm")) } : {}),
    ...(numero(v("comprimentoCm")) !== undefined
      ? { comprimentoCm: numero(v("comprimentoCm")) }
      : {}),
  };
}

/** Agrupa as linhas por SKU Pai (codErp), criando 1 produto pai + N variações. */
function construirAgrupado(
  registros: Record<string, string>[],
  cols: Record<string, string>,
  marketplacePadrao: Marketplace
): LinhaProduto[] {
  const grupos = new Map<string, Record<string, string>[]>();
  const amostrasDeCor: AmostraDeCor[] = [];
  registros.forEach((rec) => {
    const val = (c: string) => (cols[c] ? (rec[cols[c]] ?? "").trim() : "");
    const chave = val("codErp") || val("nome") || val("skuVariacao");
    const arr = grupos.get(chave) ?? [];
    arr.push(rec);
    grupos.set(chave, arr);

    amostrasDeCor.push({
      corECodigo: partesDaDerivacao(val("nomeDerivacao"), val("agrupador")).corECodigo,
      produto: chave,
    });
  });

  // O VOCABULÁRIO DE CORES SAI DO ARQUIVO, E POR ISSO VEM ANTES
  //
  // Uma palavra é cor quando REPETE entre produtos diferentes — "PRETO" em 394,
  // contra um código de fornecedor que aparece uma vez. Isso não dá para saber
  // olhando uma linha, então o arquivo inteiro é lido primeiro. Arquivo que já
  // traz coluna de cor não paga por isto: o valor da coluna vence logo abaixo.
  const vocabularioDeCor = vocabularioDeCores(amostrasDeCor);

  const linhas: LinhaProduto[] = [];
  for (const [chave, linhasGrupo] of grupos) {
    const first = linhasGrupo[0];
    const val = (c: string) => (cols[c] ? (first[cols[c]] ?? "").trim() : "");

    const variacoes: VariacaoImportada[] = linhasGrupo.map((rec) => {
      const v = (c: string) => (cols[c] ? (rec[cols[c]] ?? "").trim() : "");
      // Sem colunas de cor e tamanho, os dois saem do nome da derivação — mas SÓ
      // quando o agrupador prova onde um termina e o outro começa. Sem prova,
      // vazio, que vira pergunta.
      const partes = partesDaDerivacao(v("nomeDerivacao"), v("agrupador"));
      return {
        sku: v("skuVariacao"),
        cor: v("cor") || corDaDerivacao(partes.corECodigo, vocabularioDeCor),
        tamanho: v("tamanho") || partes.tamanho,
        ean: v("ean"),
        custo: parseNumero(v("custo")),
        precoBase: parseNumero(v("precoVenda")),
        estoque: parseInteiro(v("estoque")),
        idExterno: v("idExterno"),
        // Peso e dimensão são POR VARIAÇÃO, e é onde o banco os guarda. Numa
        // grade de calçado o 38 e o 42 não pesam o mesmo.
        ...medidasDaLinha(v),
      };
    });

    // Preço/custo do pai = representativo (1ª variação com preço); estoque = soma.
    const repr = variacoes.find((x) => x.precoBase > 0) ?? variacoes[0];
    const custo = repr?.custo ?? 0;
    const precoVenda = repr?.precoBase ?? 0;
    const estoque = variacoes.reduce((s, x) => s + x.estoque, 0);
    const margem = margemZion(custo, precoVenda);
    const confiancaCusto = normalizarConfianca(val("confianca"));

    const base: BaseProduto = {
      // O nome sai da PRIMEIRA linha do grupo, e é por isso que tirar a
      // derivação importa aqui mais do que no modo flat: sem o corte, uma
      // família inteira ficava batizada pela primeira derivação — "avela ipe
      // 39" virava o nome de um produto com dezenas de cores e tamanhos.
      nome: nomeSemDerivacao(val("nome"), val("nomeDerivacao")) || "Produto sem nome",
      marca: val("marca"),
      modelo: val("modelo"),
      categoria: val("categoria"),
      sku: chave, // SKU Pai (do ERP) — nunca o MLB
      cor: "",
      tamanho: "",
      custo,
      precoVenda,
      estoque,
      marketplace: resolverMarketplace(val("marketplace"), marketplacePadrao),
      statusCadastro: "Não iniciado",
      statusSeo: "Pendente",
      statusDescricao: "Pendente",
      statusImagens: "Pendente",
      statusPrecificacao: "Pendente",
      prioridade: "Média",
      observacoes: `Importado da base (${variacoes.length} derivações).`,
      tipoProduto: "com_variacao",
      codErp: chave || undefined,
      precoMinimo: precoMinimoZion(custo) ?? undefined,
      margem: margem ?? undefined,
      confiancaCusto,
    };

    // As palavras-chave do PAI. No modo agrupado todas as derivações do mesmo
    // código repetem o texto de busca do produto; a primeira preenchida basta.
    const palavrasChave = (
      linhasGrupo
        .map((rec) => (cols.palavrasChave ? (rec[cols.palavrasChave] ?? "") : ""))
        .find((v) => v.trim()) ?? ""
    ).trim();
    linhas.push({ base, margem, variacoes, ...(palavrasChave ? { palavrasChave } : {}) });
  }
  return linhas;
}

export function analisarProdutosCsv(
  texto: string,
  // A base é marketplace-agnóstica (fonte do ERP). O canal é destino, definido
  // depois, ao criar o anúncio. Só usamos um default se a planilha trouxer a
  // coluna "marketplace" preenchida.
  marketplacePadrao: Marketplace = "Mercado Livre",
  // Mapeamento explícito (campo canônico → coluna) vindo do assistente. Quando
  // ausente, cai no reconhecimento automático por apelidos.
  mapeamento?: Record<string, string>
): AnaliseProdutos {
  const vazio: AnaliseProdutos = {
    modo: "flat",
    total: 0,
    totalVariacoes: 0,
    colunasReconhecidas: [],
    colunasIgnoradas: [],
    faltandoObrigatorias: ["nome"],
    amostra: [],
    linhas: [],
    avisoDeGrade: null,
    avisoDePeso: null,
    avisoDeCodigo: null,
  };
  const { headers, linhas: registros } = parseCsv(texto);
  if (headers.length === 0 || registros.length === 0) {
    return { ...vazio, erro: "Arquivo vazio ou sem linhas de dados." };
  }

  const cols = mapeamento
    ? Object.fromEntries(
        Object.entries(mapeamento).filter(([, h]) => h && headers.includes(h))
      )
    : mapearColunas(headers);
  const usadas = new Set(Object.values(cols));
  const colunasIgnoradas = headers.filter((h) => !usadas.has(h));
  const faltandoObrigatorias = ["nome"].filter((c) => !cols[c]);

  // Modo agrupado quando a planilha traz SKU de variação (produto pai + derivações).
  const agrupado = Boolean(cols["skuVariacao"]);
  const linhas = agrupado
    ? construirAgrupado(registros, cols, marketplacePadrao)
    : registros.map((r) => mapearLinha(r, cols, marketplacePadrao));

  // O olhar que faltava: o arquivo tinha derivação e o modo caiu em flat?
  //
  // As colunas USADAS entram na busca porque o LINX chama a derivação de
  // `Código`, que os apelidos entregam ao SKU — procurar só nas ignoradas
  // deixaria passar justamente o caso que originou o módulo.

  const avisoDeGrade = avisoDeGradeAchatada({
    agrupado,
    registros,
    ...(cols["nome"] ? { colunaNome: cols["nome"] } : {}),
    colunasIgnoradas,
    colunasUsadas: Object.values(cols),
  });

  return {
    modo: agrupado ? "agrupado" : "flat",
    total: linhas.length,
    totalVariacoes: linhas.reduce((s, l) => s + (l.variacoes?.length ?? 0), 0),
    colunasReconhecidas: Object.keys(cols),
    colunasIgnoradas,
    faltandoObrigatorias,
    amostra: linhas.slice(0, 8),
    linhas,
    avisoDeGrade,
    // A régua é a mediana do PRÓPRIO arquivo, então ela é calculada sobre
    // todas as variações — não sobre a amostra, que são oito.
    avisoDePeso: avisoDePesoImplausivel(linhas.flatMap((l) => l.variacoes ?? [])),
    // Sobre as linhas TODAS, não sobre a amostra de oito: o caso real tinha 22
    // ocorrências em 1003 linhas, e nenhuma delas nas oito primeiras.
    avisoDeCodigo: avisoDeCodigoQueEPalavra(
      linhas.map((l) => ({ nome: l.base.nome, sku: l.base.sku, codErp: l.base.codErp }))
    ),
  };
}

export interface ResumoImportacaoProdutos {
  total: number;
  totalVariacoes: number;
  comMargemBaixa: number;
  /** Quantos atributos saíram das palavras-chave — ver a função abaixo. */
  atributosPropostos: number;
}

/**
 * O QUE AS PALAVRAS-CHAVE DO ERP PROPÕEM — e por que isto abre um laço.
 *
 * ===========================================================================
 * O LAÇO, MEDIDO EM 28/08/2026
 * ===========================================================================
 *
 * `produto_atributos` tinha DOIS escritores: a aba de atributos, que é tela da
 * EQUIPE, e o "enriquecer" do Mercado Livre, que copia de volta os atributos
 * dos anúncios JÁ PUBLICADOS. Uma loja que nunca publicou não alcança nenhum
 * dos dois — e publicar exige o atributo. Atributo vinha de anúncio publicado;
 * publicar exigia atributo.
 *
 * Por isso o catálogo do T1 tem ZERO linhas ali, enquanto a loja que já vende
 * tem 549. E por isso o conserto do mesmo dia — o cadastro completar a ficha —
 * não resolve nada para quem chega novo: não há cadastro a consultar.
 *
 * Esta função é a terceira porta, e a única que uma loja nova atravessa
 * sozinha: a importação passa a escrever ali.
 *
 * ===========================================================================
 * A FONTE, E POR QUE ELA SERVE
 * ===========================================================================
 *
 * A exportação real do Magazord tem 28 colunas e NENHUMA é "Gênero" — nem
 * "Cor", nem "Tamanho" (confirmado em 26/08: o ERP não tem esse relatório). Mas
 * `Palavras Chave` vem preenchida em 6.815 das 7.224 linhas, e o gênero está
 * lá: "chinelo masculino", "sandália infantil feminina".
 *
 * Medido contra os anúncios que a publicação recusava por gênero ausente:
 *
 *     nome do cadastro .....  2 de 12
 *     título do anúncio ....  5 de 12
 *     PALAVRAS-CHAVE ....... 10 de 12
 *
 * ===========================================================================
 * PROPÕE, NÃO AFIRMA — e a diferença está em ONDE isto escreve
 * ===========================================================================
 *
 * Ler gênero de texto livre de SEO é dedução, e `doCadastroParaOPayload` recusa
 * dedução. A recusa continua de pé, e esta função não a contorna: ela não
 * escreve no payload. Escreve em `produto_atributos`, com `origem:
 * "Importação"`, ONDE A LOJISTA VÊ E CORRIGE antes de qualquer anúncio subir.
 *
 * Deduzir para PROPOR à dona do produto é diferente de deduzir para AFIRMAR ao
 * marketplace. A origem gravada é o que mantém as duas distinguíveis: o que ela
 * respondeu à mão fica com a origem da tela, e isto fica com a da importação.
 *
 * NÃO APAGA NADA. `criarAtributosBulk` só acrescenta — ao contrário de
 * `substituirAtributosDoMarketplace`, que varre a origem dela inteira antes de
 * gravar. Aqui os produtos acabaram de ser criados nesta mesma chamada, então
 * não há o que sobrescrever; e o dia em que houver, a escolha já está feita: o
 * que a lojista respondeu não é varrido por uma importação.
 */
/** O código do ERP do produto já gravado, quando ele tem um. */
function produtoCriadoCodErp(p: { codErp?: string | null }): string {
  return p.codErp ?? "";
}

async function gravarAtributosDasPalavrasChave(
  clienteId: string,
  criados: readonly { id: string; codErp?: string | null }[],
  linhas: readonly LinhaProduto[]
): Promise<number> {
  // CASADO POR `codErp`, NÃO POR ÍNDICE.
  //
  // `criarProdutos` promete ordem preservada num comentário, e as variações já
  // dependiam disso. Um consumidor a mais da mesma promessa é um a mais para
  // quebrar junto — e o atributo trocado é pior que a variação trocada: a grade
  // ela vê na tela, o gênero só aparece no anúncio publicado.
  //
  // O índice segue como reserva para a linha sem `codErp` (a planilha plana sem
  // código pai), onde não há chave melhor.
  const porCodigo = new Map<string, string>();
  for (const l of linhas) {
    const cod = (l.base.codErp ?? "").trim();
    const texto = l.palavrasChave;
    if (cod && texto && !porCodigo.has(cod)) porCodigo.set(cod, texto);
  }

  const aGravar: Omit<ProdutoAtributo, "id">[] = [];
  criados.forEach((prod, i) => {
    const cod = (produtoCriadoCodErp(prod) ?? "").trim();
    const texto = cod ? (porCodigo.get(cod) ?? linhas[i]?.palavrasChave) : linhas[i]?.palavrasChave;
    if (!texto) return;
    // `atributosParaOCadastro` já descarta o que não tem nome exibido: gravar
    // pelo id cru criaria a linha e ninguém a acharia. A regra mora junto do
    // vocabulário, e o backfill do ERP chama a MESMA.
    for (const a of atributosParaOCadastro(texto)) {
      aGravar.push({
        produtoId: prod.id,
        clienteId,
        nomeAtributo: a.nomeAtributo,
        valorAtributo: a.valorAtributo,
        tipoAtributo: "texto",
        obrigatorio: false,
        origem: "Importação",
      });
    }
  });
  if (aGravar.length === 0) return 0;
  try {
    await criarAtributosBulk(aGravar);
  } catch (e) {
    // Falhar aqui NÃO invalida a importação: os produtos e as variações já
    // estão gravados, e o atributo é uma PROPOSTA. O efeito de não gravar é o
    // de antes desta função existir.
    console.error("[Zion OS] atributos das palavras-chave não gravados:", e);
    return 0;
  }
  return aGravar.length;
}


export async function confirmarImportacaoProdutos(params: {
  clienteId: string;
  cliente: string;
  linhas: LinhaProduto[];
}): Promise<ResumoImportacaoProdutos> {
  const { clienteId, cliente, linhas } = params;
  const produtos = linhas.map((l) => ({ ...l.base, clienteId, cliente }));
  const criados = await criarProdutos(produtos); // ordem preservada

  // Modo agrupado: cria as derivações de cada produto (SKU Variação, cor, tamanho).
  const variantes: Omit<ProdutoVariante, "id">[] = [];
  criados.forEach((prod, i) => {
    (linhas[i]?.variacoes ?? []).forEach((v) => {
      variantes.push({
        produtoId: prod.id,
        clienteId,
        sku: v.sku,
        codigoInterno: "",
        ean: v.ean,
        cor: v.cor,
        tamanho: v.tamanho,
        voltagem: "",
        sabor: "",
        aroma: "",
        modeloVariacao: "",
        custo: v.custo,
        precoBase: v.precoBase,
        estoque: v.estoque,
        peso: v.pesoKg ?? 0,
        altura: v.alturaCm ?? 0,
        largura: v.larguraCm ?? 0,
        comprimento: v.comprimentoCm ?? 0,
        status: "Ativa",
        observacoes: v.idExterno ? `MLB: ${v.idExterno}` : "",
      });
    });
  });
  if (variantes.length > 0) await criarVariantesBulk(variantes);

  const atributos = await gravarAtributosDasPalavrasChave(clienteId, criados, linhas);

  return {
    total: produtos.length,
    atributosPropostos: atributos,
    totalVariacoes: variantes.length,
    // Margem desconhecida não entra na contagem: só conta o que se sabe baixo.
    comMargemBaixa: linhas.filter((l) => l.margem !== null && l.margem < 5).length,
  };
}

// ---- Template de exemplo ----

function campoCsv(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function gerarTemplateProdutosCsv(): string {
  const ex1 = ["Chinelo Slide Feminino Conforto", "Beira Rio", "8360", "Calçados > Chinelos", "MLB2001", "Preto", "34-39", "18,00", "59,90", "120", "Mercado Livre", "2640553", "alta"];
  const ex2 = ["Fone Bluetooth TWS", "TechSound", "TWS-Pro", "Áudio > Fones", "MLB2002", "Preto", "Único", "45,00", "199,90", "40", "Mercado Livre", "", "media"];
  return [COLUNAS, ex1, ex2].map((l) => l.map(campoCsv).join(",")).join("\r\n");
}

export const COLUNAS_PRODUTOS = COLUNAS;
