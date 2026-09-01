// O CONTEXTO do Copilot, medido no SERVIDOR com o tenant da sessão.
//
// Até aqui a rota de conversa recebia do navegador `contexto.pergunta` (as
// contagens da loja), `contexto.produtos` (o catálogo para o código resolver
// "qual produto") e `produtoAberto`. Quatro ferramentas de leitura — `contar`,
// `estado_da_loja`, `proximo_passo`, `o_que_impede` — respondiam a partir
// desse objeto. O modelo não inventava o número; o corpo podia. E o número
// envelhecia desde a carga da tela. (Auditoria do Copilot, 2026-08-22, P1.)
//
// Agora tudo isso sai daqui: `service_role` + `.eq("cliente_id", …)` em toda
// consulta, e a MESMA conta (`montarEstadoDaLoja`) que a via rápida do
// navegador faz — para as duas não discordarem sobre a mesma loja.
//
// E a LOJA vem de `resolverLojaDoCopilot`: lojista é a própria (o corpo é
// ignorado); agência e equipe dizem qual, e o banco confirma que alcançam.
//
// ⚠️ Server-only.

import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { lerTudoPaginado, lerTudoPorIds } from "@/lib/supabase/paginado";
import {
  exigirAcessoAoCliente,
  type ContextoAutorizado,
} from "@/lib/auth/serverAuthorization";
import { montarEstadoDaLoja, type ProdutoParaContar } from "@/modules/assistant/domain/estadoDaLoja";
import { pendenciasDaMemoria } from "@/lib/client-portal/pendenciasDaMemoria";
import { estadoDeOtimizacao } from "@/lib/client-portal/metrics";
import type { AnuncioGeradoRegistro } from "@/lib/types";
import type { ContextoDaPergunta } from "@/modules/assistant/domain/perguntaDaOperacao";
import type { ProdutoAlvo } from "@/modules/assistant/domain/propostaDeCorrecao";

/**
 * Qual loja esta requisição opera.
 *
 * - `cliente`: a própria, do perfil. O corpo é IGNORADO — um `lojaId` ali
 *   seria o navegador escolhendo o tenant.
 * - `agencia` / `equipe`: precisam dizer qual (`lojaId`), e quem confirma que
 *   alcançam é `exigirAcessoAoCliente` (agência↔loja vem do banco, sob RLS).
 *   Sem `lojaId`, 403 — não existe "loja padrão" para quem opera várias.
 *
 * Devolve o contexto autorizado JÁ com a loja conferida.
 */
export async function resolverLojaDoCopilot(
  request: Request,
  ctx: ContextoAutorizado,
  lojaIdDoCorpo: string | undefined
): Promise<{ ctx: ContextoAutorizado; lojaId: string } | { erro: Response }> {
  if (ctx.perfil.papel === "cliente") {
    const lojaId = ctx.perfil.clienteId;
    if (!lojaId) return { erro: Response.json({ erro: "Sessão sem cliente associado." }, { status: 403 }) };
    return { ctx, lojaId };
  }
  const lojaId = typeof lojaIdDoCorpo === "string" ? lojaIdDoCorpo.trim() : "";
  if (!lojaId) {
    return {
      erro: Response.json(
        { erro: "Escolha a loja que você está operando para usar o assistente." },
        { status: 403 }
      ),
    };
  }
  try {
    const autorizado = await exigirAcessoAoCliente(request, lojaId);
    return { ctx: autorizado, lojaId };
  } catch {
    // Mesma frase para "não existe" e "não é sua".
    return { erro: Response.json({ erro: "Sem permissão para esta loja." }, { status: 403 }) };
  }
}

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
}

/** Gramas a partir do peso em kg das variantes — o MAIOR, como na tela. */
const paraGramas = (kg: number) => Math.round(Math.max(0, kg) * 1000);

interface CatalogoMedido {
  produtos: (ProdutoAlvo & ProdutoParaContar & { precoVenda: number; vendedorPagaFrete?: boolean })[];
  comFoto: Set<string>;
}

async function medirCatalogo(clienteId: string): Promise<CatalogoMedido> {
  const admin = getSupabaseAdmin();
  const linhas = await lerTudoPaginado<LinhaDeProduto>("produtos da loja", (de, ate) =>
    admin
      .from("produtos")
      .select("id, nome, marca, custo, preco_venda, vendedor_paga_frete")
      .eq("cliente_id", clienteId)
      .order("id", { ascending: true })
      .range(de, ate)
  );
  const ids = linhas.map((p) => p.id);
  if (ids.length === 0) return { produtos: [], comFoto: new Set() };

  const [variantes, imagens] = await Promise.all([
    lerTudoPorIds<LinhaDeVariante>("variantes da loja", ids, (lote, de, ate) =>
      admin
        .from("produto_variantes")
        .select("produto_id, peso")
        .eq("cliente_id", clienteId)
        .in("produto_id", lote)
        .order("id", { ascending: true })
        .range(de, ate)
    ),
    lerTudoPorIds<{ produto_id: string | null }>("imagens da loja", ids, (lote, de, ate) =>
      admin
        .from("imagens_produto")
        .select("produto_id")
        .eq("cliente_id", clienteId)
        .in("produto_id", lote)
        .order("id", { ascending: true })
        .range(de, ate)
    ),
  ]);

  const porProduto = new Map<string, LinhaDeVariante[]>();
  for (const v of variantes) {
    const arr = porProduto.get(v.produto_id);
    if (arr) arr.push(v);
    else porProduto.set(v.produto_id, [v]);
  }
  const comFoto = new Set(imagens.map((i) => i.produto_id).filter((x): x is string => Boolean(x)));

  const produtos = linhas.map((p) => {
    const vs = porProduto.get(p.id) ?? [];
    const maior = vs.reduce((acc, v) => Math.max(acc, Number(v.peso) || 0), 0);
    return {
      id: p.id,
      nome: p.nome,
      marca: p.marca ?? "",
      custo: Number(p.custo ?? 0),
      precoVenda: Number(p.preco_venda ?? 0),
      pesoGramas: paraGramas(maior),
      quantidadeVariantes: vs.length,
      // Contado, não deduzido do máximo (INC-001).
      variacoesSemPeso: vs.filter((v) => !((Number(v.peso) || 0) > 0)).length,
      ...(p.vendedor_paga_frete === null || p.vendedor_paga_frete === undefined
        ? {}
        : { vendedorPagaFrete: p.vendedor_paga_frete }),
    };
  });
  return { produtos, comFoto };
}

/**
 * O que as quatro ferramentas de leitura precisam: as contagens da loja, o
 * catálogo-alvo e (se houver) o produto aberto — tudo medido agora, no banco.
 *
 * `produtoAbertoId` é um PONTEIRO do navegador: só vira "produto aberto" se
 * existir nesta loja. Id de outra loja é tratado como nenhum produto.
 */
export async function contextoDoCopilotNoServidor(
  clienteId: string,
  produtoAbertoId: string | null | undefined
): Promise<{
  pergunta: ContextoDaPergunta;
  produtos: ProdutoAlvo[];
  produtoAberto: { id: string; nome: string } | null;
}> {
  const admin = getSupabaseAdmin();
  const [catalogo, anuncios, canal, infracoes] = await Promise.all([
    medirCatalogo(clienteId),
    // AS COLUNAS DO MUNDO DEPOIS DA PUBLICACAO.
    //
    // Isto lia `produto_id, status` — o bastante para contar quem tem anuncio,
    // e cego para tudo que acontece DEPOIS que ele sobe. Com o estado assim, o
    // servidor montava uma loja sem pendencia e sem "no ar sem IA", e o chat
    // respondia "nada travado" a uma lojista com 70 pendencias e 2708 pecas
    // paradas.
    //
    // Sao as colunas que `pendenciasDaConta` e `estadoDeOtimizacao` exigem, e
    // nada alem: continua sem o JSONB da esteira, que e 76,6% do peso da linha.
    lerTudoPaginado<{
      produto_id: string | null;
      status: string;
      ml_item_id: string | null;
      ml_permalink: string | null;
      status_marketplace: string | null;
      status_marketplace_em: string | null;
      estoque_marketplace: number | null;
      sub_status_marketplace: string[] | null;
      foto_capa_max_size: string | null;
      nota_diagnostico: number | null;
      // `produto` NÃO É COLUNA — é o nome que vem do JOIN, e pedi-lo como
      // coluna derrubava a rota inteira. Ver o bloco abaixo do `select`.
      produtos: { nome: string | null } | null;
      created_at: string;
    }>("anúncios da loja", (de, ate) =>
      admin
        .from("anuncios_gerados")
        // ---- `produtos(nome)` É EMBUTIMENTO, e a linha abaixo já foi `produto`.
        //
        // MEDIDO EM 25/08/2026, com a rota respondendo 500 em TODO turno:
        //
        //   column anuncios_gerados.produto does not exist
        //
        // `anuncios_gerados` não tem coluna `produto`. O nome do produto sempre
        // veio do JOIN — `mappers.ts` escreve `row.produtos?.nome ?? null` — e
        // aqui ele foi pedido como se fosse coluna da própria tabela. O
        // PostgREST recusa a leitura inteira, `lerTudoPaginado` lança, e o
        // assistente morre antes de montar o contexto: nenhuma ferramenta roda,
        // nenhum turno é gravado.
        //
        // Entrou na mescla de 24/08/2026 ("96 commits de lá, 100 daqui, 15
        // conflitos"), e é por isso que `copilot_mensagens` para naquele dia: o
        // chat não ficou ruim, ficou MORTO, e o silêncio parecia desuso.
        //
        // O embutimento custa um texto curto por linha e não traz o JSONB da
        // esteira, que continua fora — o motivo da lista enxuta segue valendo.
        .select(
          "produto_id, status, ml_item_id, ml_permalink, status_marketplace, " +
            "status_marketplace_em, estoque_marketplace, sub_status_marketplace, " +
            "foto_capa_max_size, nota_diagnostico, produtos(nome), created_at"
        )
        .eq("cliente_id", clienteId)
        .order("id", { ascending: true })
        .range(de, ate)
    ),
    admin
      .from("canais_marketplace")
      .select("ativo")
      .eq("cliente_id", clienteId)
      .eq("marketplace", "Mercado Livre")
      .maybeSingle(),
    // Leitura que falhou não vira "nenhuma infração": fica `null`, que a conta
    // trata como "não olhei" — e a tela não afirma zero.
    // `filter_subgroup` E `motivo` ENTRAM porque a classificacao depende deles:
    // `pendenciasDaConta` separa propriedade intelectual do resto por ai, e
    // foto se conserta refotografando enquanto acusacao de falsificado nao.
    //
    // `remedio` NAO entra, e a omissao e deliberada: ele so alimenta o TEXTO do
    // cartao, nunca o agrupamento (a chave e familia + tipo) nem o estoque. O
    // servidor aqui consome so as tres contagens de `noAr`. Traze-lo exigiria
    // duplicar a limpeza de HTML que vive privada em `infracoesMarketplace`, e
    // uma regra em dois lugares e como este repositorio colecionou defeito.
    lerTudoPaginado<{
      related_item_id: string | null;
      motivo: string | null;
      filter_subgroup: string | null;
    }>("infrações da loja", (de, ate) =>
      admin
        .from("infracoes_marketplace")
        .select("related_item_id, motivo, filter_subgroup")
        .eq("cliente_id", clienteId)
        .order("id", { ascending: true })
        .range(de, ate)
    ).catch(() => null),
  ]);

  // O MUNDO DEPOIS DA PUBLICACAO, pelas MESMAS funcoes que o navegador usa.
  //
  // `pendenciasDaMemoria` e `estadoDeOtimizacao` sao puras e ja sao a verdade
  // desses dois numeros em Meus Produtos, Relatorios e na Visao geral. Conta-los
  // aqui seria a quarta versao de uma regra que ja discordou de si mesma em tres
  // telas no dia 03/08/2026.
  const paraPendencia = anuncios.map((a) => ({
    mlItemId: a.ml_item_id,
    // Do JOIN, e com a MESMA expressão de `mappers.ts` — duas formas de ler o
    // nome do produto divergiriam no dia em que uma mudasse.
    produto: a.produtos?.nome ?? null,
    mlPermalink: a.ml_permalink,
    statusMarketplace: a.status_marketplace,
    statusMarketplaceEm: a.status_marketplace_em,
    estoqueMarketplace: a.estoque_marketplace,
    subStatusMarketplace: a.sub_status_marketplace,
    fotoCapaMaxSize: a.foto_capa_max_size,
  }));
  const mapaDeInfracoes: Record<string, { motivo: string; remedio: string; categoria: string }[]> =
    {};
  for (const l of infracoes ?? []) {
    if (!l.related_item_id) continue;
    (mapaDeInfracoes[l.related_item_id] ??= []).push({
      categoria: l.filter_subgroup ?? "",
      motivo: l.motivo ?? "",
      remedio: "",
    });
  }
  // So conta quando a leitura das infracoes CHEGOU: sem o mapa, o agrupamento
  // devolveria menos pendencias do que existem, e numero baixo e pior que
  // numero nenhum — ele parece medido.
  const pend = infracoes === null ? null : pendenciasDaMemoria(paraPendencia, mapaDeInfracoes);
  const noAr = pend
    ? {
        pendenciasAbertas: pend.grupos.length,
        pecasParadas: pend.estoqueTravado,
        noArSemOtimizacao: [
          ...estadoDeOtimizacao(
            anuncios.map((a) => ({
              produtoId: a.produto_id,
              // O banco devolve texto; o tipo do app e um enum fechado. O
              // `estadoDeOtimizacao` so compara com "aprovado" e "publicado",
              // entao um valor fora do enum cai em "Em revisao" — que e a
              // leitura certa para status desconhecido.
              status: a.status as AnuncioGeradoRegistro["status"],
              notaDiagnostico: a.nota_diagnostico ?? 0,
              criadoEm: a.created_at,
            }))
          ).values(),
        ].filter((e) => e === "No ar, sem otimização").length,
      }
    : null;

  const loja = montarEstadoDaLoja(
    catalogo.produtos,
    anuncios.map((a) => ({ produtoId: a.produto_id, status: a.status })),
    [...catalogo.comFoto].map((id) => ({ produtoId: id })),
    Boolean((canal.data as { ativo?: boolean | null } | null)?.ativo),
    infracoes === null
      ? null
      : {
          infracoes: infracoes.length,
          anuncios: new Set(infracoes.map((l) => l.related_item_id).filter(Boolean)).size,
        },
    noAr
  );

  const produtos: ProdutoAlvo[] = catalogo.produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    marca: p.marca,
    custo: p.custo,
    quantidadeVariantes: p.quantidadeVariantes,
    variacoesSemPeso: p.variacoesSemPeso,
  }));

  const aberto = produtoAbertoId ? catalogo.produtos.find((p) => p.id === produtoAbertoId) : undefined;
  if (!aberto) return { pergunta: { loja }, produtos, produtoAberto: null };

  return {
    pergunta: {
      loja,
      produto: {
        id: aberto.id,
        nome: aberto.nome,
        estado: {
          custo: aberto.custo,
          precoVenda: aberto.precoVenda,
          pesoGramas: aberto.pesoGramas,
          temFoto: catalogo.comFoto.has(aberto.id),
          ...(aberto.vendedorPagaFrete === undefined ? {} : { vendedorPagaFrete: aberto.vendedorPagaFrete }),
        },
      },
    },
    produtos,
    produtoAberto: { id: aberto.id, nome: aberto.nome },
  };
}
