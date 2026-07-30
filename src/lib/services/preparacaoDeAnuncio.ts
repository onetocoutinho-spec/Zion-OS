// O catálogo lido para a preparação de anúncio — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin (service_role). Nunca no navegador.
//
// A DECISÃO é toda do orquestrador puro (`publication/domain/preparacaoDoAnuncio`),
// testado sem banco. Aqui está só a leitura: produto, grade, imagens e o anúncio
// que já existe — as quatro coisas de que a avaliação precisa e que ela não
// pode inventar.
//
// ANTES ISTO VINHA DO NAVEGADOR. `propor_anuncio` lia `contexto.paraAnunciar`,
// montado pela tela e enviado no corpo da requisição. Funcionava, e era a mesma
// classe de buraco que a Proposal persistida fechou: quem manda o corpo escolhe
// o que o servidor acredita. Agora o tenant vem da sessão e os dados vêm do
// banco.

import { getSupabaseAdmin } from "../supabase/admin";
import type {
  AnuncioJaGerado,
  ProdutoParaPreparar,
} from "../../modules/publication/domain/preparacaoDoAnuncio";
import type { VarianteDaBase } from "../../modules/publication/domain/variacoesDoAnuncio";

/**
 * Quantos produtos atravessam numa varredura de lote.
 *
 * O PostgREST corta em 1.000 e não avisa. Aqui o corte é EXPLÍCITO e o total
 * real acompanha o resultado, para a frase poder dizer "olhei 300 dos 730".
 */
export const LIMITE_DE_PRODUTOS = 300;

interface LinhaDeProduto {
  id: string;
  nome: string;
  marca: string | null;
  modelo: string | null;
  custo: number | null;
  preco_venda: number | null;
  vendedor_paga_frete: boolean | null;
}

interface LinhaDeVariante {
  id: string;
  produto_id: string;
  sku: string | null;
  ean: string | null;
  cor: string | null;
  tamanho: string | null;
  estoque: number | null;
  preco_base: number | null;
  /** KG na coluna. Vira GRAMAS na borda, uma vez. */
  peso: number | null;
  altura: number | null;
  largura: number | null;
  comprimento: number | null;
}

interface LinhaDeAnuncio {
  produto_id: string | null;
  status: string;
  veredito_a10: string | null;
  qtd_pendencias: number | null;
  ml_item_id: string | null;
  criado_em: string;
}

export interface ProdutoComAnuncio {
  produto: ProdutoParaPreparar;
  anuncio: AnuncioJaGerado | null;
}

export interface CatalogoParaPreparar {
  itens: ProdutoComAnuncio[];
  totalNoCatalogo: number;
  truncado: boolean;
}

function paraVariante(v: LinhaDeVariante): VarianteDaBase {
  return {
    sku: v.sku ?? "",
    ean: v.ean ?? "",
    cor: v.cor ?? "",
    tamanho: v.tamanho ?? "",
    estoque: Number(v.estoque ?? 0),
    precoBase: Number(v.preco_base ?? 0),
  };
}

/**
 * A embalagem do produto — a MAIOR entre as variantes.
 *
 * O frete cobra pela caixa que sai, e é a maior que decide. Média produziria
 * uma caixa que nenhuma variante tem.
 */
function embalagemDoProduto(variantes: readonly LinhaDeVariante[]): {
  pesoGramas: number;
  alturaCm: number;
  larguraCm: number;
  comprimentoCm: number;
} {
  const maior = (campo: "peso" | "altura" | "largura" | "comprimento") =>
    variantes.reduce((m, v) => Math.max(m, Number(v[campo] ?? 0)), 0);
  return {
    pesoGramas: Math.round(maior("peso") * 1000),
    alturaCm: maior("altura"),
    larguraCm: maior("largura"),
    comprimentoCm: maior("comprimento"),
  };
}

function montar(
  p: LinhaDeProduto,
  variantes: readonly LinhaDeVariante[],
  imagens: number
): ProdutoParaPreparar {
  return {
    id: p.id,
    nome: p.nome,
    marca: p.marca ?? "",
    modelo: p.modelo ?? "",
    custo: Number(p.custo ?? 0),
    precoVenda: Number(p.preco_venda ?? 0),
    ...embalagemDoProduto(variantes),
    quantidadeImagens: imagens,
    // `null` no banco significa "não sabemos quem paga" (034), e o domínio já
    // assume que o vendedor paga quando não se sabe — supor o contrário
    // dispensaria o peso e inflaria a margem.
    ...(p.vendedor_paga_frete === false ? { vendedorPagaFrete: false } : {}),
    variantes: variantes.map(paraVariante),
  };
}

/** O anúncio mais recente de cada produto. É o estado que a preparação consulta. */
function anuncioMaisRecente(linhas: readonly LinhaDeAnuncio[]): Map<string, AnuncioJaGerado> {
  const mapa = new Map<string, AnuncioJaGerado>();
  for (const a of linhas) {
    if (!a.produto_id || mapa.has(a.produto_id)) continue;
    mapa.set(a.produto_id, {
      status: a.status,
      vereditoA10: a.veredito_a10 ?? "",
      qtdPendencias: Number(a.qtd_pendencias ?? 0),
      mlItemId: a.ml_item_id,
    });
  }
  return mapa;
}

const CAMPOS_VARIANTE = "id, produto_id, sku, ean, cor, tamanho, estoque, preco_base, peso, altura, largura, comprimento";
const CAMPOS_ANUNCIO = "produto_id, status, veredito_a10, qtd_pendencias, ml_item_id, criado_em";

/** Um produto só, para "prepare a Modare 7178.102" e para o drill-down. */
export async function produtoParaPreparar(
  clienteId: string,
  produtoId: string
): Promise<ProdutoComAnuncio | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("produtos")
    .select("id, nome, marca, modelo, custo, preco_venda, vendedor_paga_frete")
    .eq("cliente_id", clienteId)
    .eq("id", produtoId)
    .maybeSingle();
  const p = data as LinhaDeProduto | null;
  // Produto de outro tenant é indistinguível de inexistente.
  if (!p) return null;

  const [variantes, imagens, anuncios] = await Promise.all([
    admin.from("produto_variantes").select(CAMPOS_VARIANTE).eq("cliente_id", clienteId).eq("produto_id", produtoId),
    admin.from("imagens_produto").select("produto_id").eq("produto_id", produtoId),
    admin
      .from("anuncios_gerados")
      .select(CAMPOS_ANUNCIO)
      .eq("cliente_id", clienteId)
      .eq("produto_id", produtoId)
      .order("criado_em", { ascending: false })
      .limit(1),
  ]);

  const linhasDeVariante = (variantes.data ?? []) as LinhaDeVariante[];
  return {
    produto: montar(p, linhasDeVariante, ((imagens.data ?? []) as unknown[]).length),
    anuncio: anuncioMaisRecente((anuncios.data ?? []) as LinhaDeAnuncio[]).get(produtoId) ?? null,
  };
}

/** O catálogo inteiro, para "prepare todos que estiverem prontos". */
export async function catalogoParaPreparar(clienteId: string): Promise<CatalogoParaPreparar> {
  const admin = getSupabaseAdmin();
  const { data, count } = await admin
    .from("produtos")
    .select("id, nome, marca, modelo, custo, preco_venda, vendedor_paga_frete", { count: "exact" })
    .eq("cliente_id", clienteId)
    .order("nome")
    .limit(LIMITE_DE_PRODUTOS);
  const produtos = (data ?? []) as LinhaDeProduto[];
  if (produtos.length === 0) {
    return { itens: [], totalNoCatalogo: count ?? 0, truncado: false };
  }
  const ids = produtos.map((p) => p.id);

  const [variantes, imagens, anuncios] = await Promise.all([
    admin.from("produto_variantes").select(CAMPOS_VARIANTE).eq("cliente_id", clienteId).in("produto_id", ids),
    admin.from("imagens_produto").select("produto_id").in("produto_id", ids),
    admin
      .from("anuncios_gerados")
      .select(CAMPOS_ANUNCIO)
      .eq("cliente_id", clienteId)
      .in("produto_id", ids)
      .order("criado_em", { ascending: false }),
  ]);

  const porProduto = new Map<string, LinhaDeVariante[]>();
  for (const v of (variantes.data ?? []) as LinhaDeVariante[]) {
    const lista = porProduto.get(v.produto_id) ?? [];
    lista.push(v);
    porProduto.set(v.produto_id, lista);
  }
  const contagemDeImagens = new Map<string, number>();
  for (const i of (imagens.data ?? []) as { produto_id: string | null }[]) {
    if (!i.produto_id) continue;
    contagemDeImagens.set(i.produto_id, (contagemDeImagens.get(i.produto_id) ?? 0) + 1);
  }
  const porAnuncio = anuncioMaisRecente((anuncios.data ?? []) as LinhaDeAnuncio[]);

  return {
    itens: produtos.map((p) => ({
      produto: montar(p, porProduto.get(p.id) ?? [], contagemDeImagens.get(p.id) ?? 0),
      anuncio: porAnuncio.get(p.id) ?? null,
    })),
    totalNoCatalogo: count ?? produtos.length,
    truncado: (count ?? 0) > produtos.length,
  };
}

/** A margem mínima do lojista, lida no servidor. Nunca zero por omissão. */
export async function margemDoCliente(clienteId: string, padrao: number): Promise<number> {
  try {
    const { data } = await getSupabaseAdmin()
      .from("clientes")
      .select("margem_minima")
      .eq("id", clienteId)
      .maybeSingle();
    const m = Number((data as { margem_minima?: number } | null)?.margem_minima);
    return Number.isFinite(m) ? m : padrao;
  } catch {
    return padrao;
  }
}

// ---------------------------------------------------------------------------
// título
// ---------------------------------------------------------------------------

export interface AnuncioParaTitulo {
  anuncioId: string;
  produtoId: string;
  nome: string;
  tituloAtual: string;
  status: string;
}

/**
 * O anúncio cujo título se quer melhorar.
 *
 * Precisa EXISTIR: "melhore o título" sobre um produto sem anúncio não tem o
 * que melhorar, e gerar um anúncio inteiro para isso seria outra intenção, com
 * outro custo.
 */
export async function anuncioParaTitulo(
  clienteId: string,
  produtoId: string
): Promise<AnuncioParaTitulo | null> {
  try {
    const { data } = await getSupabaseAdmin()
      .from("anuncios_gerados")
      .select("id, produto_id, produtos(nome), anuncio, status, criado_em")
      .eq("cliente_id", clienteId)
      .eq("produto_id", produtoId)
      .order("criado_em", { ascending: false })
      .limit(1);
    const linha = ((data ?? []) as LinhaComAnuncio[])[0];
    if (!linha) return null;
    const pai = Array.isArray(linha.produtos) ? linha.produtos[0] : linha.produtos;
    return {
      anuncioId: linha.id,
      produtoId: linha.produto_id ?? produtoId,
      nome: pai?.nome ?? "",
      tituloAtual: String(linha.anuncio?.tituloOtimizado ?? ""),
      status: linha.status,
    };
  } catch (e) {
    console.error("[preparacao] falha ao ler o anúncio para título:", e);
    return null;
  }
}

interface LinhaComAnuncio {
  id: string;
  produto_id: string | null;
  produtos: { nome: string } | { nome: string }[] | null;
  anuncio: { tituloOtimizado?: string } | null;
  status: string;
}

/**
 * Grava o título aprovado no anúncio — e SÓ o título.
 *
 * Lê o payload, troca um campo, grava de volta. Reescrever o objeto inteiro a
 * partir do que o modelo devolveu apagaria descrição, ficha e grade, que não
 * estavam em discussão.
 */
export async function aplicarTitulo(
  anuncioId: string,
  clienteId: string,
  titulo: string
): Promise<{ antes: string; depois: string } | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("anuncios_gerados")
    .select("anuncio")
    .eq("id", anuncioId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  const atual = (data as { anuncio?: Record<string, unknown> } | null)?.anuncio;
  if (!atual) return null;

  const antes = String(atual.tituloOtimizado ?? "");
  const { error } = await admin
    .from("anuncios_gerados")
    .update({ anuncio: { ...atual, tituloOtimizado: titulo } })
    .eq("id", anuncioId)
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);
  return { antes, depois: titulo };
}
