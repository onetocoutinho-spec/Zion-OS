// /api/catalogo/custos — a tela "Custos da loja".
//
// GET  monta as linhas da tabela: produto + custo + de onde ele veio + estado
//      (ausente/confirmado/conflito) + quantos SKUs herdam.
// POST define ou RESOLVE o custo de um produto.
//
// POR QUE ROTA, E NÃO LEITURA/ESCRITA DIRETA DO NAVEGADOR
//
// A leitura cruza QUATRO fontes (produtos, produto_variantes,
// procedencia_de_campo, custo_pendencias) e monta uma linha por produto — um
// round-trip do servidor evita N consultas do navegador para N produtos.
//
// A escrita precisa gravar `registrarProcedencia` (server-only, migração 038)
// e, quando há pendência aberta, fechar `custo_pendencias` com o id VERDADEIRO
// do usuário da sessão — um valor que o corpo da requisição poderia forjar
// nunca decide quem resolveu o quê.

import { getSupabaseAdmin, adminConfigurado } from "@/lib/supabase/admin";
import { exigirAcessoAoCliente, respostaErroAutorizacao } from "@/lib/auth/serverAuthorization";
import { respostaDeErro } from "@/lib/http/respostaDeErro";
import { registrarProcedencia } from "@/lib/services/procedencia";
import { margemZion } from "@/lib/services/importacaoProdutos";
import { lerTudoPaginado } from "@/lib/supabase/paginado";
import {
  candidatosValidos,
  montarLinhaDeCusto,
  ordenarLinhasDeCusto,
  planoDeResolucao,
  type LinhaDeCusto,
} from "@/modules/catalog/domain/custosDoCatalogo";
import type { MetodoDeEntrada, OrigemDoValor, Procedencia } from "@/modules/catalog/domain/procedenciaDeCampo";

interface LinhaProduto {
  id: string;
  nome: string;
  sku: string | null;
  custo: number | null;
  preco_venda: number | null;
}

interface LinhaVariante {
  produto_id: string;
}

interface LinhaProcedencia {
  entidade_id: string;
  origem: string;
  metodo: string;
  ator: string | null;
  evidencia_registro: string | null;
  evidencia_id: string | null;
  registrado_em: string;
}

interface LinhaPendencia {
  produto_id: string;
  candidatos: unknown;
}

export async function GET(request: Request) {
  const clienteId = new URL(request.url).searchParams.get("clienteId") ?? "";
  if (!clienteId) {
    return Response.json({ erro: "clienteId ausente." }, { status: 400 });
  }

  try {
    await exigirAcessoAoCliente(request, clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (!adminConfigurado()) {
    return Response.json({ erro: "Indisponível no momento." }, { status: 503 });
  }

  const admin = getSupabaseAdmin();

  try {
    // QUATRO leituras do CATÁLOGO INTEIRO — é literalmente o que esta tela faz
    // ("varrer o catálogo procurando..."). O PostgREST corta em 1.000 linhas
    // sem avisar, e um catálogo de porte médio já passa disso em variantes ou
    // em histórico de procedência. `lerTudoPaginado` é o helper único do
    // repositório para isto — ver `leituraNaoTruncada.test.ts`.
    const [produtos, variantes, procedencias, pendencias] = await Promise.all([
      lerTudoPaginado<LinhaProduto>("produtos do catálogo", (de, ate) =>
        admin
          .from("produtos")
          .select("id, nome, sku, custo, preco_venda")
          .eq("cliente_id", clienteId)
          .order("id", { ascending: true })
          .range(de, ate)
      ),
      lerTudoPaginado<LinhaVariante>("variantes do catálogo", (de, ate) =>
        admin
          .from("produto_variantes")
          .select("produto_id")
          .eq("cliente_id", clienteId)
          .order("id", { ascending: true })
          .range(de, ate)
      ),
      lerTudoPaginado<LinhaProcedencia>("procedência de custo do catálogo", (de, ate) =>
        admin
          .from("procedencia_de_campo")
          .select("entidade_id, origem, metodo, ator, evidencia_registro, evidencia_id, registrado_em")
          .eq("cliente_id", clienteId)
          .eq("campo", "custo")
          .eq("entidade_tipo", "produto")
          .order("registrado_em", { ascending: false })
          .order("id", { ascending: true })
          .range(de, ate)
      ),
      lerTudoPaginado<LinhaPendencia>("pendências de custo abertas", (de, ate) =>
        admin
          .from("custo_pendencias")
          .select("produto_id, candidatos")
          .eq("cliente_id", clienteId)
          .is("resolvido_em", null)
          .order("id", { ascending: true })
          .range(de, ate)
      ),
    ]);

    const totalVariantesPorProduto = new Map<string, number>();
    for (const v of variantes) {
      totalVariantesPorProduto.set(v.produto_id, (totalVariantesPorProduto.get(v.produto_id) ?? 0) + 1);
    }

    // Já ordenado por `registrado_em desc`: a PRIMEIRA linha de cada produto é
    // a mais recente. `procedencia_de_campo_campo_idx` (038) existe
    // exatamente para esta varredura.
    const fontePorProduto = new Map<string, Procedencia>();
    for (const linha of procedencias) {
      if (fontePorProduto.has(linha.entidade_id)) continue;
      fontePorProduto.set(linha.entidade_id, {
        origem: linha.origem as OrigemDoValor,
        metodo: linha.metodo as MetodoDeEntrada,
        ator: linha.ator,
        momento: linha.registrado_em,
        ...(linha.evidencia_registro && linha.evidencia_id
          ? { evidencia: { registro: linha.evidencia_registro, id: linha.evidencia_id } }
          : {}),
      });
    }

    const pendenciaPorProduto = new Map<string, { candidatos: ReturnType<typeof candidatosValidos> }>();
    for (const p of pendencias) {
      pendenciaPorProduto.set(p.produto_id, { candidatos: candidatosValidos(p.candidatos) });
    }

    const linhas: LinhaDeCusto[] = produtos.map((p) =>
      montarLinhaDeCusto({
        produtoId: p.id,
        nome: p.nome,
        sku: p.sku ?? "",
        custo: Number(p.custo ?? 0),
        precoVenda: Number(p.preco_venda ?? 0),
        totalVariantes: totalVariantesPorProduto.get(p.id) ?? 0,
        fonte: fontePorProduto.get(p.id),
        pendenciaAberta: pendenciaPorProduto.get(p.id) ?? null,
      })
    );

    return Response.json({ linhas: ordenarLinhasDeCusto(linhas) });
  } catch (e) {
    return respostaDeErro("catalogo/custos", e, "Não foi possível carregar os custos.");
  }
}

interface CorpoPost {
  clienteId?: string;
  produtoId?: string;
  valor?: number;
}

export async function POST(request: Request) {
  let corpo: CorpoPost;
  try {
    corpo = (await request.json()) as CorpoPost;
  } catch {
    return Response.json({ erro: "Corpo inválido." }, { status: 400 });
  }
  if (!corpo?.clienteId || !corpo.produtoId) {
    return Response.json({ erro: "clienteId ou produtoId ausente." }, { status: 400 });
  }
  const valor = Number(corpo.valor);
  if (!Number.isFinite(valor) || !(valor > 0)) {
    return Response.json({ erro: "Custo inválido." }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await exigirAcessoAoCliente(request, corpo.clienteId);
  } catch (e) {
    return respostaErroAutorizacao(e);
  }

  if (!adminConfigurado()) {
    return Response.json({ erro: "Indisponível no momento." }, { status: 503 });
  }

  const admin = getSupabaseAdmin();
  const { clienteId, produtoId } = corpo as { clienteId: string; produtoId: string };

  try {
    const { data: produto, error: erroProduto } = await admin
      .from("produtos")
      .select("id, custo, preco_venda")
      .eq("id", produtoId)
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (erroProduto) throw new Error(erroProduto.message);
    if (!produto) {
      return Response.json({ erro: "Produto não encontrado nesta loja." }, { status: 404 });
    }

    const { data: pendencia, error: erroPendencia } = await admin
      .from("custo_pendencias")
      .select("id, candidatos")
      .eq("produto_id", produtoId)
      .eq("cliente_id", clienteId)
      .is("resolvido_em", null)
      .maybeSingle();
    if (erroPendencia) throw new Error(erroPendencia.message);

    const custoAnterior = Number(produto.custo ?? 0);
    const margem = margemZion(valor, Number(produto.preco_venda ?? 0));

    const { error: erroUpdate } = await admin
      .from("produtos")
      .update({ custo: valor, margem: margem ?? null, confianca_custo: "alta" })
      .eq("id", produtoId)
      .eq("cliente_id", clienteId);
    if (erroUpdate) throw new Error(erroUpdate.message);

    // MESMO ESPELHAMENTO DE SEMPRE (definirCustoEscolhido, importacaoCustos):
    // a variação sem custo próprio herda o do pai, e por decisão pós-incidente
    // (R$ 30 milhões) não existe exceção por SKU — trocar o custo do produto
    // troca o de TODAS as suas variações.
    const { data: variantesAtualizadas, error: erroVariantes } = await admin
      .from("produto_variantes")
      .update({ custo: valor })
      .eq("produto_id", produtoId)
      .eq("cliente_id", clienteId)
      .select("id");
    if (erroVariantes) throw new Error(erroVariantes.message);

    let tinhaConflito = false;
    if (pendencia) {
      tinhaConflito = true;
      const plano = planoDeResolucao(candidatosValidos(pendencia.candidatos), valor);
      const { error: erroResolucao } = await admin
        .from("custo_pendencias")
        .update({
          resolvido_em: new Date().toISOString(),
          resolvido_por: ctx.usuario?.id ?? null,
          valor_escolhido: plano.valorEscolhido,
          descartados: plano.descartados,
        })
        .eq("id", pendencia.id);
      if (erroResolucao) throw new Error(erroResolucao.message);
    }

    // A PROCEDÊNCIA DO VALOR VENCEDOR — nunca lança (ver o comentário da
    // função): se isto falhar, o custo já gravado não é desfeito, só a coluna
    // "fonte" da tela fica sem este registro até a próxima edição.
    await registrarProcedencia({
      clienteId,
      entidade: { tipo: "produto", id: produtoId },
      campo: "custo",
      valor: String(valor),
      valorAnterior: custoAnterior > 0 ? String(custoAnterior) : null,
      origem: "cliente",
      metodo: "cadastro_manual",
      ator: ctx.usuario?.id ?? null,
      ...(pendencia ? { evidencia: { registro: "custo_pendencias", id: pendencia.id as string } } : {}),
    });

    return Response.json({
      ok: true,
      tinhaConflito,
      variantes: (variantesAtualizadas ?? []).length,
    });
  } catch (e) {
    return respostaDeErro("catalogo/custos", e, "Não foi possível gravar o custo.");
  }
}
