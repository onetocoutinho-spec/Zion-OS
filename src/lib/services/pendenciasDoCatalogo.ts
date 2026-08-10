// O catálogo, lido para análise de pendências — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin (service_role). Nunca no navegador.
//
// TUDO MEDIDO, NADA DEDUZIDO. O peso vem da coluna da VARIANTE, uma a uma —
// não do maior do produto. A pergunta aqui é "esta variante tem peso?", e o
// maior do produto responderia "sim" para uma variante vazia. Foi exatamente
// essa confusão que fez a tela dizer "peso completo" com 12 variações vazias
// no banco (INC-001).
//
// O TENANT VEM DE FORA, derivado da sessão pela rota, e é aplicado em toda
// query. Um produto de outro cliente não aparece — não "aparece marcado como de
// outro", simplesmente não existe do ponto de vista de quem perguntou.

import { getSupabaseAdmin } from "../supabase/admin";
import { lerTudoPorIds } from "../supabase/paginado";
import type {
  ProdutoParaAnalise,
  VarianteParaAnalise,
} from "../../modules/catalog/domain/pendenciasDoCatalogo";

/**
 * Quantos produtos atravessam.
 *
 * O PostgREST corta em 1.000 linhas e não avisa — foi assim que a importação
 * leu 1.000 de 3.085 e ninguém percebeu. Aqui o limite é EXPLÍCITO e o total
 * real acompanha o resultado, para a frase poder dizer "analisei 500 dos 730".
 */
export const LIMITE_DE_PRODUTOS = 500;

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
  /** KG na coluna. Vira GRAMAS no domínio, na borda, uma vez. */
  peso: number | null;
}

export interface CatalogoParaAnalise {
  produtos: ProdutoParaAnalise[];
  /** Quantos existem de verdade. Diferente de `produtos.length` = truncado. */
  totalNoCatalogo: number;
  truncado: boolean;
}

/**
 * O catálogo do cliente, pronto para a análise de pendências.
 *
 * Três consultas e nenhuma junção em SQL: o join do PostgREST em duas tabelas
 * grandes com filtro de tenant nas duas é mais caro e mais frágil que juntar em
 * memória 500 produtos. E juntar aqui deixa a regra visível.
 */
export async function catalogoParaAnalise(clienteId: string): Promise<CatalogoParaAnalise> {
  const admin = getSupabaseAdmin();

  const { data: linhas, count } = await admin
    .from("produtos")
    .select("id, nome, marca, modelo, custo, preco_venda, vendedor_paga_frete", { count: "exact" })
    .eq("cliente_id", clienteId)
    .order("nome")
    .limit(LIMITE_DE_PRODUTOS);
  const produtos = (linhas ?? []) as LinhaDeProduto[];
  if (produtos.length === 0) {
    return { produtos: [], totalNoCatalogo: count ?? 0, truncado: false };
  }
  const ids = produtos.map((p) => p.id);

  // PAGINADO. `LIMITE_DE_PRODUTOS` é 500, e a média medida é de 12,1 variantes
  // por produto: 6.000 linhas, cortadas em 1.000 pelo PostgREST sem erro. Hoje
  // a base tem 80 produtos e 970 variantes — passa raspando, e o dia em que não
  // passar não vem com aviso.
  const [variantes, imagens] = await Promise.all([
    lerTudoPorIds<LinhaDeVariante>("variantes do catálogo", ids, (lote, de, ate) =>
      admin
        .from("produto_variantes")
        .select("id, produto_id, sku, ean, cor, tamanho, peso")
        .eq("cliente_id", clienteId)
        .in("produto_id", lote)
        .order("id", { ascending: true })
        .range(de, ate)
    ),
    lerTudoPorIds<{ produto_id: string }>("imagens do catálogo", ids, (lote, de, ate) =>
      admin
        .from("imagens_produto")
        .select("produto_id")
        .in("produto_id", lote)
        .order("id", { ascending: true })
        .range(de, ate)
    ),
  ]);

  const porProduto = new Map<string, VarianteParaAnalise[]>();
  for (const v of variantes) {
    const lista = porProduto.get(v.produto_id) ?? [];
    lista.push({
      id: v.id,
      sku: v.sku ?? "",
      ean: v.ean ?? "",
      cor: v.cor ?? "",
      tamanho: v.tamanho ?? "",
      // KG -> GRAMAS aqui, uma vez, na borda. O domínio inteiro fala gramas.
      pesoGramas: v.peso && v.peso > 0 ? Math.round(v.peso * 1000) : 0,
    });
    porProduto.set(v.produto_id, lista);
  }

  const comImagem = new Set(
    (imagens as { produto_id: string | null }[])
      .map((i) => i.produto_id)
      .filter((id): id is string => Boolean(id))
  );

  return {
    produtos: produtos.map((p) => ({
      id: p.id,
      nome: p.nome,
      marca: p.marca ?? "",
      modelo: p.modelo ?? "",
      custo: Number(p.custo ?? 0),
      precoVenda: Number(p.preco_venda ?? 0),
      temFoto: comImagem.has(p.id),
      // `null` no banco significa "não sabemos quem paga" (034), e o domínio
      // já assume que o vendedor paga quando não se sabe — supor o contrário
      // dispensaria o peso e inflaria a margem.
      ...(p.vendedor_paga_frete === false ? { vendedorPagaFrete: false } : {}),
      variantes: porProduto.get(p.id) ?? [],
    })),
    totalNoCatalogo: count ?? produtos.length,
    truncado: (count ?? 0) > produtos.length,
  };
}

/** Um produto só, para o drill-down de "por que este aqui está travado?". */
export async function produtoParaAnalise(
  clienteId: string,
  produtoId: string
): Promise<ProdutoParaAnalise | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("produtos")
    .select("id, nome, marca, modelo, custo, preco_venda, vendedor_paga_frete")
    .eq("cliente_id", clienteId)
    .eq("id", produtoId)
    .maybeSingle();
  const p = data as LinhaDeProduto | null;
  // Produto de outro tenant é indistinguível de inexistente: o filtro por
  // cliente já garante isso, e a resposta é `null` nos dois casos.
  if (!p) return null;

  const [variantes, imagens] = await Promise.all([
    admin
      .from("produto_variantes")
      .select("id, produto_id, sku, ean, cor, tamanho, peso")
      .eq("cliente_id", clienteId)
      .eq("produto_id", produtoId),
    admin.from("imagens_produto").select("produto_id").eq("produto_id", produtoId).limit(1),
  ]);

  return {
    id: p.id,
    nome: p.nome,
    marca: p.marca ?? "",
    modelo: p.modelo ?? "",
    custo: Number(p.custo ?? 0),
    precoVenda: Number(p.preco_venda ?? 0),
    temFoto: ((imagens.data ?? []) as unknown[]).length > 0,
    ...(p.vendedor_paga_frete === false ? { vendedorPagaFrete: false } : {}),
    variantes: ((variantes.data ?? []) as LinhaDeVariante[]).map((v) => ({
      id: v.id,
      sku: v.sku ?? "",
      ean: v.ean ?? "",
      cor: v.cor ?? "",
      tamanho: v.tamanho ?? "",
      pesoGramas: v.peso && v.peso > 0 ? Math.round(v.peso * 1000) : 0,
    })),
  };
}

/**
 * As fontes conectadas, pelo que elas DECLARAM saber fazer.
 *
 * O domínio nunca pergunta "é o Magazord?" — ele pergunta "alguma fonte declara
 * `ler_custo`?". Hoje a resposta é não: o conector Magazord é read-only de
 * CATÁLOGO e declara apenas conectar, testar, renovar e sincronizar. Custo,
 * preço e estoque ficaram fora do escopo dele, e por isso o Copilot não promete
 * buscá-los lá.
 *
 * Quando um conector passar a declarar `ler_custo`, ele aparece aqui e o
 * resolvedor passa a considerá-lo — sem um `if` de ERP em lugar nenhum.
 */
export async function fontesConectadas(
  clienteId: string
): Promise<{ nome: string; capacidades: ReadonlySet<string> }[]> {
  // Nenhum conector de ERP está ligado a um cliente do portal hoje: a tabela de
  // canais só conhece marketplace. Devolver lista vazia é o estado real, e é o
  // que faz o resolvedor dizer "preciso de você" em vez de "vou buscar no ERP".
  void clienteId;
  return [];
}
