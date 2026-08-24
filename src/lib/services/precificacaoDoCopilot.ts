// Os números reais do preço — SERVIDOR APENAS.
//
// ⚠️ Importa o cliente admin (service_role). Nunca no navegador.
//
// A CONTA é toda de `pricing/domain` — `modeloPreco` e `conversaDePreco`,
// testados sem banco. Aqui está só a montagem do `ModeloTaxas`: ler o produto,
// a embalagem, a margem e os sete custos do lojista, e entregar ao domínio.
//
// A COMISSÃO, e por que ela sai como ESTIMADA aqui.
//
// A tarifa exata do ML vem de `/sites/MLB/listing_prices` e depende de TRÊS
// coisas: a categoria do produto, o preço e o tipo de anúncio. Consultá-la
// exige o access_token do lojista, o que obriga a rotacionar o refresh_token a
// cada chamada — e ela é POR PREÇO, então uma simulação de três cenários seriam
// três rotações.
//
// Nesta base a maior parte dos produtos não tem `categoriaMarketplaceSugerida`
// preenchida, e sem categoria a rota `/api/ml/custos` sequer chama a tarifa.
// Então o caminho honesto é: calcular com a TABELA e dizer que é estimativa. A
// tela de precificação continua sendo onde o número exato aparece.
//
// O domínio não muda por causa disso: `comissaoPercentual` prefere
// `percentualVendaML` quando ele existe. Quando um dia a API alimentar esta
// camada, a conta é a mesma e só a procedência muda de `tabela` para `api`.

import { getSupabaseAdmin } from "../supabase/admin";
import { lerTudoPaginado, lerTudoPorIds } from "../supabase/paginado";
import {
  MARGEM_MINIMA_PADRAO,
  TAXAS_PADRAO,
  margemLiquida,
  type ModeloTaxas,
} from "../../modules/pricing/domain/modeloPreco";
import { nomeDoTipoDeAnuncio, tipoUnicoDosAnuncios } from "../../modules/pricing/domain/custosML";
import {
  normalizarCustos,
  SEM_CUSTOS_DO_LOJISTA,
  temCustosInformados,
  type CustosDoLojista,
} from "../../modules/pricing/domain/custosDoLojista";
import type {
  EntradasDoPreco,
  ProcedenciaDoCalculo,
  ProdutoParaTriagem,
} from "../../modules/pricing/domain/conversaDePreco";
import { anomaliaDeCusto } from "../../modules/catalog/domain/anomaliasDoCatalogo";
import { embalagemDe } from "../../modules/pricing/domain/embalagemDoProduto";

/**
 * Quantos produtos a triagem varre por vez.
 *
 * O PostgREST corta em 1.000 e não avisa. Aqui o corte é explícito e o total
 * real acompanha — a frase pode dizer "olhei 300 dos 730" em vez de afirmar o
 * catálogo inteiro.
 */
export const LIMITE_DA_TRIAGEM = 300;

interface LinhaDeProduto {
  id: string;
  nome: string;
  marca: string | null;
  custo: number | null;
  preco_venda: number | null;
  vendedor_paga_frete: boolean | null;
}

interface LinhaDeVariante {
  produto_id: string;
  peso: number | null;
  altura: number | null;
  largura: number | null;
  comprimento: number | null;
}

interface LinhaDeCliente {
  margem_minima: number | null;
  custo_embalagem: number | null;
  custo_etiqueta: number | null;
  custo_informativos: number | null;
  imposto_percentual: number | null;
  comissao_gestor_percentual: number | null;
  comissao_sistema_percentual: number | null;
  cupom_percentual: number | null;
}

export interface ConfiguracaoDoLojista {
  margemMinima: number;
  custos: CustosDoLojista;
}

/**
 * A configuração financeira do lojista, lida no servidor.
 *
 * As sete colunas da 033 e a margem da 029. Diante de falha, tudo zero e a
 * margem padrão — que é o comportamento de quem ainda não preencheu, e faz a
 * conta sair igual à de antes. Inventar custo por erro de rede apareceria como
 * margem menor e mandaria o lojista subir preço sem motivo.
 */
export async function configuracaoDoLojista(clienteId: string): Promise<ConfiguracaoDoLojista> {
  try {
    const { data } = await getSupabaseAdmin()
      .from("clientes")
      .select(
        "margem_minima, custo_embalagem, custo_etiqueta, custo_informativos, imposto_percentual, comissao_gestor_percentual, comissao_sistema_percentual, cupom_percentual"
      )
      .eq("id", clienteId)
      .maybeSingle();
    const l = data as LinhaDeCliente | null;
    const m = Number(l?.margem_minima);
    return {
      margemMinima: Number.isFinite(m) ? m : MARGEM_MINIMA_PADRAO,
      custos: normalizarCustos({
        embalagem: Number(l?.custo_embalagem ?? 0),
        etiqueta: Number(l?.custo_etiqueta ?? 0),
        informativos: Number(l?.custo_informativos ?? 0),
        impostoPercentual: Number(l?.imposto_percentual ?? 0),
        comissaoGestorPercentual: Number(l?.comissao_gestor_percentual ?? 0),
        comissaoSistemaPercentual: Number(l?.comissao_sistema_percentual ?? 0),
        cupomPercentual: Number(l?.cupom_percentual ?? 0),
      }),
    };
  } catch (e) {
    console.error("[pricing] falha ao ler a configuração do lojista:", e);
    return { margemMinima: MARGEM_MINIMA_PADRAO, custos: SEM_CUSTOS_DO_LOJISTA };
  }
}

// `embalagemDe` MUDOU-SE para `modules/pricing/domain/embalagemDoProduto` —
// mesmo corpo, nada reescrito. A consequência de um lote de peso precisa
// aplicá-la sobre o estado ANTES e sobre o de DEPOIS da escrita, e uma segunda
// implementação divergiria em silêncio, produzindo um número errado num cartão
// que o lojista lê como fato.

function montarTaxas(
  p: LinhaDeProduto,
  variantes: readonly LinhaDeVariante[],
  config: ConfiguracaoDoLojista,
  tipoDoAnuncioNoMl: string | null
): ModeloTaxas {
  const tipo = nomeDoTipoDeAnuncio(tipoDoAnuncioNoMl);
  return {
    ...TAXAS_PADRAO,
    // O TIPO DO ANÚNCIO, quando o ML já disse qual é (074).
    //
    // Sem ele, TAXAS_PADRAO traz "Premium" — uma suposição sobre a loja
    // inteira. Em Moda a diferença é 14% contra 19%, e ela sai no número que a
    // lojista usa para decidir preço. Tipo não reconhecido NÃO entra: cai no
    // default e a procedência diz "tabela", que é a resposta honesta.
    ...(tipo ? { tipoAnuncio: tipo } : {}),
    custosDoLojista: config.custos,
    embalagem: embalagemDe(variantes),
    // `null` no banco significa "não sabemos quem paga" (034), e o domínio já
    // assume que o vendedor paga quando não se sabe — supor o contrário
    // inflaria a margem, que é o defeito que este modelo mais repetiu.
    ...(p.vendedor_paga_frete === false ? { vendedorPagaFrete: false } : {}),
  };
}

function procedencia(
  taxas: ModeloTaxas,
  config: ConfiguracaoDoLojista,
  tipoVeioDoAnuncio: boolean
): ProcedenciaDoCalculo {
  return {
    // Ver o cabeçalho: sem a categoria e sem rotacionar credencial por preço,
    // este caminho não fala com a API de tarifas — a comissão continua saindo
    // da tabela de Moda. O que MUDA com o tipo lido do anúncio é qual linha da
    // tabela: clássico ou premium. Por isso "anuncio" e não "api": o
    // percentual é de tabela, mas o TIPO é do anúncio dela, e a diferença
    // entre 14% e 19% é o que a lojista precisa poder conferir.
    comissao: tipoVeioDoAnuncio ? "anuncio" : "tabela",
    envio:
      taxas.vendedorPagaFrete === false
        ? "nao_se_aplica"
        : taxas.embalagem
          ? "tabela_oficial"
          : "ausente",
    custosDoLojista: temCustosInformados(config.custos) ? "informados" : "zerados",
    reputacao: "padrao",
  };
}

export interface PrecoDoProduto {
  produtoId: string;
  nome: string;
  entradas: EntradasDoPreco;
}

/** Um produto, com tudo que a conta precisa. `null` = de outro tenant ou inexistente. */
export async function precoDoProduto(
  clienteId: string,
  produtoId: string
): Promise<PrecoDoProduto | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("produtos")
    .select("id, nome, marca, custo, preco_venda, vendedor_paga_frete")
    .eq("cliente_id", clienteId)
    .eq("id", produtoId)
    .maybeSingle();
  const p = data as LinhaDeProduto | null;
  if (!p) return null;

  // FORA do `Promise.all`, e por um motivo de ferramenta, não de desenho: o
  // scanner de `leituraNaoTruncada` perde a leitura IRMÃ quando uma paginada
  // entra no mesmo array — foi o que aconteceu com `produto_variantes` aqui, e
  // a lista de dispensa já registra o mesmo mascaramento em
  // `pendenciasDoCatalogo`. Uma guarda que para de enxergar não é guarda.
  // O paralelismo continua: a promessa começa agora e é aguardada depois.
  const tiposDosAnuncios = lerTudoPaginado<{ tipo_anuncio_ml: string | null }>(
    "tipo de anúncio do produto",
    (de, ate) =>
      admin
        .from("anuncios_gerados")
        .select("tipo_anuncio_ml")
        .eq("cliente_id", clienteId)
        .eq("produto_id", produtoId)
        .order("id", { ascending: true })
        .range(de, ate)
  );

  const [variantes, config] = await Promise.all([
    admin
      .from("produto_variantes")
      .select("produto_id, peso, altura, largura, comprimento")
      .eq("cliente_id", clienteId)
      .eq("produto_id", produtoId),
    configuracaoDoLojista(clienteId),
  ]);

  // O TIPO DO ANÚNCIO NO ML (074) — o que decide se a comissão é 14% ou 19%.
  //
  // PAGINADO, e não `.limit()`. Um calçado tem um anúncio por numeração — o
  // maior medido nesta base tem 41 — então um teto de 1.000 pareceria folgado.
  // Mas truncar AQUI é pior que em outros lugares: `tipoUnicoDosAnuncios`
  // devolve `null` quando os tipos DIVERGEM, e um corte que deixasse de fora
  // justamente o anúncio divergente produziria um "todos Premium" confiante e
  // errado. Ler tudo elimina o modo de falha em vez de torná-lo improvável.
  const tipoDoAnuncio = tipoUnicoDosAnuncios(
    (await tiposDosAnuncios).map((l) => l.tipo_anuncio_ml)
  );
  const taxas = montarTaxas(p, (variantes.data ?? []) as LinhaDeVariante[], config, tipoDoAnuncio);
  const custo = Number(p.custo ?? 0);
  const precoAtual = Number(p.preco_venda ?? 0);

  // A ANOMALIA vem da invariante que já existe (`custoDigitado`), reusada por
  // `anomaliasDoCatalogo`. Um custo de R$ 30.277.872 não pode produzir uma
  // recomendação com cara de precisa só porque a célula foi lida corretamente.
  const anomalia = anomaliaDeCusto({
    id: p.id,
    nome: p.nome,
    marca: p.marca ?? "",
    modelo: "",
    custo,
    precoVenda: precoAtual,
    temFoto: true,
    variantes: [],
  });

  return {
    produtoId: p.id,
    nome: p.nome,
    entradas: {
      custo,
      precoAtual,
      taxas,
      margemMinima: config.margemMinima,
      procedencia: procedencia(taxas, config, tipoDoAnuncio !== null),
      custoEmConflito: anomalia?.explicacao ?? null,
    },
  };
}

export interface CatalogoParaTriagem {
  produtos: ProdutoParaTriagem[];
  margemMinima: number;
  procedencia: ProcedenciaDoCalculo;
  totalNoCatalogo: number;
}

/**
 * O catálogo para a triagem de margem.
 *
 * TRIAGEM LOCAL, com a tabela — e a `procedencia` diz isso. A tarifa exata é
 * por produto e por preço; 300 produtos seriam 300 chamadas ao ML com rotação
 * de credencial em cada uma. A triagem acha quem está em risco; o número exato
 * sai depois, um a um.
 */
export async function catalogoParaTriagem(clienteId: string): Promise<CatalogoParaTriagem> {
  const admin = getSupabaseAdmin();
  const config = await configuracaoDoLojista(clienteId);

  const { data, count } = await admin
    .from("produtos")
    .select("id, nome, marca, custo, preco_venda, vendedor_paga_frete", { count: "exact" })
    .eq("cliente_id", clienteId)
    .order("nome")
    .limit(LIMITE_DA_TRIAGEM);
  const linhas = (data ?? []) as LinhaDeProduto[];
  if (linhas.length === 0) {
    return {
      produtos: [],
      margemMinima: config.margemMinima,
      procedencia: procedencia(TAXAS_PADRAO, config, false),
      totalNoCatalogo: count ?? 0,
    };
  }

  // PAGINADO: `linhas` acompanha o recorte do catálogo, e 12,1 variantes por
  // produto passam de 1.000 com menos de 83 produtos.
  const vars = await lerTudoPorIds<LinhaDeVariante>(
    "variantes do copiloto",
    linhas.map((l) => l.id),
    (lote, de, ate) =>
      admin
        .from("produto_variantes")
        .select("produto_id, peso, altura, largura, comprimento")
        .eq("cliente_id", clienteId)
        .in("produto_id", lote)
        .order("id", { ascending: true })
        .range(de, ate)
  );
  const porProduto = new Map<string, LinhaDeVariante[]>();
  for (const v of vars) {
    const lista = porProduto.get(v.produto_id) ?? [];
    lista.push(v);
    porProduto.set(v.produto_id, lista);
  }

  // O TIPO DE ANÚNCIO DE CADA PRODUTO (074) — o que decide 14% ou 19%.
  //
  // Uma consulta paginada para a página inteira, do mesmo jeito que as
  // variantes: um produto de calçado tem um anúncio por numeração, e 300
  // produtos passariam de 1.000 linhas com folga.
  const anunciosDaPagina = await lerTudoPorIds<{ produto_id: string | null; tipo_anuncio_ml: string | null }>(
    "tipos de anúncio do copiloto",
    linhas.map((l) => l.id),
    (lote, de, ate) =>
      admin
        .from("anuncios_gerados")
        .select("produto_id, tipo_anuncio_ml")
        .eq("cliente_id", clienteId)
        .in("produto_id", lote)
        .order("id", { ascending: true })
        .range(de, ate)
  );
  const tiposCrus = new Map<string, (string | null)[]>();
  for (const a of anunciosDaPagina) {
    if (!a.produto_id) continue;
    const lista = tiposCrus.get(a.produto_id) ?? [];
    lista.push(a.tipo_anuncio_ml);
    tiposCrus.set(a.produto_id, lista);
  }
  // `tipoUnicoDosAnuncios` devolve null quando os anúncios do produto DIVERGEM
  // — esse produto não tem UMA comissão, e escolher uma delas daria cara de
  // exato a uma pergunta sem resposta única.
  const tipoPorProduto = new Map<string, string | null>(
    [...tiposCrus].map(([id, tipos]) => [id, tipoUnicoDosAnuncios(tipos)])
  );

  return {
    produtos: linhas.map((p) => {
      const taxas = montarTaxas(p, porProduto.get(p.id) ?? [], config, tipoPorProduto.get(p.id) ?? null);
      const custo = Number(p.custo ?? 0);
      const precoVenda = Number(p.preco_venda ?? 0);
      const anomalia = anomaliaDeCusto({
        id: p.id,
        nome: p.nome,
        marca: p.marca ?? "",
        modelo: "",
        custo,
        precoVenda,
        temFoto: true,
        variantes: [],
      });
      return {
        id: p.id,
        nome: p.nome,
        custo,
        precoVenda,
        taxas,
        custoEmConflito: anomalia?.explicacao ?? null,
      };
    }),
    margemMinima: config.margemMinima,
    // TUDO OU NADA, de propósito. Uma lista em que parte dos produtos teve o
    // tipo lido do anúncio e parte não teve não é "do anúncio": dizer isso
    // sobre a lista inteira daria ao lojista uma garantia que vale só para
    // alguns. "tabela" aqui significa "pelo menos um caiu na estimativa".
    procedencia: procedencia(
      TAXAS_PADRAO,
      config,
      linhas.every((p) => (tipoPorProduto.get(p.id) ?? null) !== null)
    ),
    totalNoCatalogo: count ?? linhas.length,
  };
}

/**
 * Grava o preço aprovado — NO CATÁLOGO DO ZION, e só aí.
 *
 * "Aplicar preço" nesta vertical significa `produtos.preco_venda`. NÃO significa
 * publicar no Mercado Livre: publicar é outra ação, com outra rota, outra
 * confirmação e outro risco. Misturar as duas faria "pode aplicar" mudar o
 * anúncio que está no ar.
 *
 * A MARGEM é gravada junto porque ela é derivada do preço e já aparece na tela.
 * Deixá-la velha mostraria o preço novo com a margem antiga — um número
 * derivado de uma entrada que mudou, que é a família de defeito que este
 * sistema mais persegue.
 */
export async function aplicarPreco(
  produtoId: string,
  clienteId: string,
  preco: number,
  taxas: ModeloTaxas,
  custo: number
): Promise<{ antes: { preco: number; margem: number | null }; depois: { preco: number; margem: number | null } } | null> {
  const admin = getSupabaseAdmin();
  const { data } = await admin
    .from("produtos")
    .select("preco_venda, margem")
    .eq("id", produtoId)
    .eq("cliente_id", clienteId)
    .maybeSingle();
  const atual = data as { preco_venda?: number | null; margem?: number | null } | null;
  if (!atual) return null;

  const margem = margemLiquida(custo, preco, taxas);
  const { error } = await admin
    .from("produtos")
    .update({
      preco_venda: preco,
      // `?? undefined` não serve aqui: a coluna aceita null, e null é honesto
      // quando a margem não é calculável. Gravar 0 afirmaria "sem margem".
      margem: margem,
    })
    .eq("id", produtoId)
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);

  return {
    antes: { preco: Number(atual.preco_venda ?? 0), margem: atual.margem ?? null },
    depois: { preco, margem },
  };
}

/** O peso cobrável e o custo de hoje — para a revalidação da Proposal. */
export async function estadoParaRevalidar(
  clienteId: string,
  produtoId: string
): Promise<{ custo: number; precoAtual: number; taxas: ModeloTaxas } | null> {
  const p = await precoDoProduto(clienteId, produtoId);
  return p
    ? { custo: p.entradas.custo, precoAtual: p.entradas.precoAtual, taxas: p.entradas.taxas }
    : null;
}
