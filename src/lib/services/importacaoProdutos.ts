// Importação da BASE DE PRODUTOS (CSV/planilha) → tabela produtos.
//
// Mesmo motor do importador de auditorias: parser próprio, reconhecimento de
// colunas tolerante a acento/caixa, prévia e gravação em lote. Alimenta a
// Esteira de Anúncio (Fase 1).

import { parseCsv, normalizarHeader } from "../csv";
import { MARKETPLACES } from "../constantes";
import type { Marketplace, Produto, ProdutoVariante } from "../types";
import { criarProdutos } from "./produtos";
import { criarVariantesBulk } from "./produtoVariantes";
import {
  margemLiquida,
  precoMinimo,
  MARGEM_MINIMA_PADRAO,
} from "../../modules/pricing/domain/modeloPreco.ts";

// ---- Colunas canônicas e aliases ----

const ALIASES: Record<string, string> = {
  nome: "nome", produto: "nome", titulo: "nome", nome_do_produto: "nome", descricao_produto: "nome", item: "nome",
  marca: "marca", brand: "marca", fabricante: "marca",
  modelo: "modelo", model: "modelo", ref: "modelo", referencia: "modelo", codigo_modelo: "modelo",
  categoria: "categoria", category: "categoria", departamento: "categoria",
  sku: "sku", codigo: "sku", cod: "sku", codigo_interno: "sku", id: "sku",
  cor: "cor", color: "cor",
  tamanho: "tamanho", size: "tamanho", numeracao: "tamanho", numero: "tamanho", grade: "tamanho",
  custo: "custo", custo_unitario: "custo", preco_custo: "custo", preco_de_custo: "custo", valor_de_custo: "custo", custo_medio: "custo", custo_linx: "custo", custo_compra: "custo",
  preco: "precoVenda", preco_venda: "precoVenda", precovenda: "precoVenda", preco_de_venda: "precoVenda", valor_unitario: "precoVenda", price: "precoVenda", valor: "precoVenda", preco_atual: "precoVenda",
  // Bling/Tiny usam "Descrição" como nome do produto na exportação.
  descricao: "nome", descrição: "nome",
  estoque: "estoque", stock: "estoque", quantidade: "estoque", qtd: "estoque", saldo: "estoque", saldo_estoque: "estoque", estoque_disponivel: "estoque",
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

/** Margem % no momento da importação (taxas padrão). */
export function margemZion(custo: number, preco: number): number {
  return margemLiquida(custo, preco);
}

/** Preço mínimo no momento da importação, pelo piso padrão. */
export function precoMinimoZion(custo: number): number {
  return precoMinimo(custo, MARGEM_MINIMA_PADRAO) ?? 0;
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
}

export interface LinhaProduto {
  base: BaseProduto;
  margem: number;
  /** Preenchido no modo agrupado (base com variações). */
  variacoes?: VariacaoImportada[];
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
  erro?: string;
}

function mapearColunas(headers: string[]): Record<string, string> {
  const achado: Record<string, string> = {};
  for (const h of headers) {
    const canon = ALIASES[normalizarHeader(h)];
    if (canon && !achado[canon]) achado[canon] = h;
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
  { campo: "marketplace", rotulo: "Marketplace (opcional)" },
  { campo: "confianca", rotulo: "Confiança do custo" },
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

  const base: BaseProduto = {
    nome: val("nome") || "Produto sem nome",
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
    precoMinimo: precoMinimoZion(custo),
    margem,
    confiancaCusto,
  };

  return { base, margem };
}

/** Agrupa as linhas por SKU Pai (codErp), criando 1 produto pai + N variações. */
function construirAgrupado(
  registros: Record<string, string>[],
  cols: Record<string, string>,
  marketplacePadrao: Marketplace
): LinhaProduto[] {
  const grupos = new Map<string, Record<string, string>[]>();
  registros.forEach((rec) => {
    const val = (c: string) => (cols[c] ? (rec[cols[c]] ?? "").trim() : "");
    const chave = val("codErp") || val("nome") || val("skuVariacao");
    const arr = grupos.get(chave) ?? [];
    arr.push(rec);
    grupos.set(chave, arr);
  });

  const linhas: LinhaProduto[] = [];
  for (const [chave, linhasGrupo] of grupos) {
    const first = linhasGrupo[0];
    const val = (c: string) => (cols[c] ? (first[cols[c]] ?? "").trim() : "");

    const variacoes: VariacaoImportada[] = linhasGrupo.map((rec) => {
      const v = (c: string) => (cols[c] ? (rec[cols[c]] ?? "").trim() : "");
      return {
        sku: v("skuVariacao"),
        cor: v("cor"),
        tamanho: v("tamanho"),
        ean: v("ean"),
        custo: parseNumero(v("custo")),
        precoBase: parseNumero(v("precoVenda")),
        estoque: parseInteiro(v("estoque")),
        idExterno: v("idExterno"),
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
      nome: val("nome") || "Produto sem nome",
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
      precoMinimo: precoMinimoZion(custo),
      margem,
      confiancaCusto,
    };

    linhas.push({ base, margem, variacoes });
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

  return {
    modo: agrupado ? "agrupado" : "flat",
    total: linhas.length,
    totalVariacoes: linhas.reduce((s, l) => s + (l.variacoes?.length ?? 0), 0),
    colunasReconhecidas: Object.keys(cols),
    colunasIgnoradas,
    faltandoObrigatorias,
    amostra: linhas.slice(0, 8),
    linhas,
  };
}

export interface ResumoImportacaoProdutos {
  total: number;
  totalVariacoes: number;
  comMargemBaixa: number;
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
        peso: 0,
        altura: 0,
        largura: 0,
        comprimento: 0,
        status: "Ativa",
        observacoes: v.idExterno ? `MLB: ${v.idExterno}` : "",
      });
    });
  });
  if (variantes.length > 0) await criarVariantesBulk(variantes);

  return {
    total: produtos.length,
    totalVariacoes: variantes.length,
    comMargemBaixa: linhas.filter((l) => l.margem < 5).length,
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
