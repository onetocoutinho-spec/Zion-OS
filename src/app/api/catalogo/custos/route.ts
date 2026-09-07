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
import {
  candidatosValidos,
  montarLinhaDeCusto,
  ordenarLinhasDeCusto,
  planoDeResolucao,
  type LinhaDeCusto,
} from "@/modules/catalog/domain/custosDoCatalogo";
import type { MetodoDeEntrada, OrigemDoValor, Procedencia } from "@/modules/catalog/domain/procedenciaDeCampo";

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
    const [produtosResp, variantesResp, procedenciaResp, pendenciasResp] = await Promise.all([
      admin.from("produtos").select("id, nome, sku, custo").eq("cliente_id", clienteId).order("nome"),
      admin.from("produto_variantes").select("produto_id").eq("cliente_id", clienteId),
      admin
        .from("procedencia_de_campo")
        .select("entidade_id, origem, metodo, ator, evidencia_registro, evidencia_id, registrado_em")
        .eq("cliente_id", clienteId)
        .eq("campo", "custo")
        .eq("entidade_tipo", "produto")
        .order("registrado_em", { ascending: false }),
      admin
        .from("custo_pendencias")
        .select("produto_id, candidatos")
        .eq("cliente_id", clienteId)
        .is("resolvido_em", null),
    ]);
    if (produtosResp.error) throw new Error(produtosResp.error.message);
    if (variantesResp.error) throw new Error(variantesResp.error.message);
    if (procedenciaResp.error) throw new Error(procedenciaResp.error.message);
    if (pendenciasResp.error) throw new Error(pendenciasResp.error.message);

    const totalVariantesPorProduto = new Map<string, number>();
    for (const v of variantesResp.data ?? []) {
      const id = v.produto_id as string;
      totalVariantesPorProduto.set(id, (totalVariantesPorProduto.get(id) ?? 0) + 1);
    }

    // Já ordenado por `registrado_em desc`: a PRIMEIRA linha de cada produto é
    // a mais recente. `procedencia_de_campo_campo_idx` (038) existe
    // exatamente para esta varredura.
    const fontePorProduto = new Map<string, Procedencia>();
    for (const linha of procedenciaResp.data ?? []) {
      const id = linha.entidade_id as string;
      if (fontePorProduto.has(id)) continue;
      fontePorProduto.set(id, {
        origem: linha.origem as OrigemDoValor,
        metodo: linha.metodo as MetodoDeEntrada,
        ator: linha.ator as string | null,
        momento: linha.registrado_em as string,
        ...(linha.evidencia_registro && linha.evidencia_id
          ? { evidencia: { registro: linha.evidencia_registro as string, id: linha.evidencia_id as string } }
          : {}),
      });
    }

    const pendenciaPorProduto = new Map<string, { candidatos: ReturnType<typeof candidatosValidos> }>();
    for (const p of pendenciasResp.data ?? []) {
      pendenciaPorProduto.set(p.produto_id as string, { candidatos: candidatosValidos(p.candidatos) });
    }

    const linhas: LinhaDeCusto[] = (produtosResp.data ?? []).map((p) =>
      montarLinhaDeCusto({
        produtoId: p.id as string,
        nome: p.nome as string,
        sku: (p.sku as string | null) ?? "",
        custo: Number(p.custo ?? 0),
        totalVariantes: totalVariantesPorProduto.get(p.id as string) ?? 0,
        fonte: fontePorProduto.get(p.id as string),
        pendenciaAberta: pendenciaPorProduto.get(p.id as string) ?? null,
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
