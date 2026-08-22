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
    lerTudoPaginado<{ produto_id: string | null; status: string }>("anúncios da loja", (de, ate) =>
      admin
        .from("anuncios_gerados")
        .select("produto_id, status")
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
    lerTudoPaginado<{ related_item_id: string | null }>("infrações da loja", (de, ate) =>
      admin
        .from("infracoes_marketplace")
        .select("related_item_id")
        .eq("cliente_id", clienteId)
        .order("id", { ascending: true })
        .range(de, ate)
    ).catch(() => null),
  ]);

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
        }
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
